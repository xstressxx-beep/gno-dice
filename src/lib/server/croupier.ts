// Le croupier : service côté serveur (routes /api/croupier/*) qui tire les dés.
//
// - Il signe ses transactions avec son propre wallet, dont la phrase secrète
//   est dans la variable d'environnement CROUPIER_MNEMONIC (serveur uniquement,
//   jamais envoyée au navigateur).
// - Il ne connaît JAMAIS le chiffre du joueur au moment du tirage : il ne voit
//   que l'empreinte. La graine (32 octets) vient du générateur cryptographique.
// - Il peut aussi relayer la révélation (Reveal) pour que le joueur n'ait
//   qu'une seule signature à faire ; le contrat vérifie tout de toute façon.
//
// Fiabilité : une transaction à la fois (numéro de séquence du compte),
// nouvel essai seulement sur les pannes réseau / séquence, et l'état de la
// partie est relu avant chaque essai (aucun double tirage ni double paiement).

import { randomBytes } from "node:crypto";
import { GnoJSONRPCProvider, GnoWallet } from "@gnolang/gno-js-client";
import { TransactionEndpoint } from "@gnolang/tm2-js-client";
import { config, GAS } from "@/lib/config";
import { commitment, isHex64 } from "@/lib/fairness";
import { estimateFee, fetchGame, fetchGameInfo, fetchOpenGames, type Game } from "@/lib/gno";
import { log } from "./log";

export class CroupierError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Marge de sécurité avant la limite de tirage : au-delà, la partie sera remboursée.
const DEADLINE_MARGIN_S = 20;
const RETRY_DELAYS_MS = [1_000, 2_500];

let walletPromise: Promise<GnoWallet> | null = null;

export function croupierConfigured(): boolean {
  return Boolean(process.env.CROUPIER_MNEMONIC?.trim());
}

function assertConfigured() {
  if (!croupierConfigured()) throw new CroupierError("Croupier non configuré (CROUPIER_MNEMONIC manquant).", 503);
}

async function getWallet(): Promise<GnoWallet> {
  assertConfigured();
  walletPromise ??= (async () => {
    const wallet = await GnoWallet.fromMnemonic(process.env.CROUPIER_MNEMONIC!.trim(), { addressPrefix: "g" });
    wallet.connect(await GnoJSONRPCProvider.create(config.rpcUrl));
    return wallet;
  })();
  try {
    return await walletPromise;
  } catch (e) {
    walletPromise = null;
    throw e;
  }
}

// --- Une transaction à la fois ---

let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Panne passagère (réseau, séquence du compte) : un nouvel essai a du sens. */
function isTransient(message: string): boolean {
  return /sequence|timeout|timed out|fetch failed|econn|socket|503|502|504|network/i.test(message);
}

type TxResponse = { hash?: string; check_tx?: { ResponseBase?: { Error?: unknown; Log?: string } }; deliver_tx?: { ResponseBase?: { Error?: unknown; Log?: string } } };

async function callContract(method: "Resolve" | "Reveal", args: string[]): Promise<string> {
  const wallet = await getWallet();
  const gas = method === "Resolve" ? GAS.resolve : GAS.reveal;
  const fee = { gas_wanted: BigInt(gas), gas_fee: `${await estimateFee(gas)}ugnot` };
  const res = (await wallet.callMethod(config.realmPath, method, args, TransactionEndpoint.BROADCAST_TX_COMMIT, undefined, undefined, fee)) as TxResponse;
  const failure = res.check_tx?.ResponseBase?.Error ? res.check_tx.ResponseBase : res.deliver_tx?.ResponseBase?.Error ? res.deliver_tx.ResponseBase : null;
  if (failure) throw new Error(failure.Log || "transaction refusée");
  return res.hash ?? "";
}

/**
 * Envoie une transaction avec quelques nouveaux essais sur panne passagère.
 * `stillNeeded` relit l'état avant chaque essai : si un essai précédent a en
 * fait réussi (réponse perdue), on s'arrête sans rien renvoyer.
 */
async function sendWithRetry(method: "Resolve" | "Reveal", args: string[], id: number, stillNeeded: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    if (attempt > 0 && !(await stillNeeded())) return;
    const started = Date.now();
    try {
      const hash = await callContract(method, args);
      log("info", "croupier.tx", { method, id, hash, attempt, ms: Date.now() - started });
      return;
    } catch (e) {
      // Erreur de configuration (phrase secrète absente…) : on la remonte telle quelle.
      if (e instanceof CroupierError) throw e;
      const message = e instanceof Error ? e.message : String(e);
      const retry = isTransient(message) && attempt < RETRY_DELAYS_MS.length;
      log(retry ? "warn" : "error", "croupier.tx_failed", { method, id, attempt, ms: Date.now() - started, error: message.slice(0, 300) });
      if (!retry) throw new CroupierError("La transaction du croupier a échoué.", 502);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

// --- Actions ---

function canStillResolve(game: Game): boolean {
  return game.status === "pending" && Date.now() / 1000 < game.resolveDeadline - DEADLINE_MARGIN_S;
}

/** Tire le dé d'une partie en attente. Sans effet si elle est déjà tirée. */
export async function resolveGame(id: number): Promise<Game> {
  assertConfigured();
  const game = await fetchGame(id);
  if (!game) throw new CroupierError("Partie introuvable.", 404);
  if (!canStillResolve(game)) return game;

  await serialize(async () => {
    const fresh = await fetchGame(id);
    if (!fresh || !canStillResolve(fresh)) return;
    // Graine tirée par le générateur cryptographique du serveur. En cas de
    // nouvel essai (panne réseau), la même graine est renvoyée : elle n'a pas
    // pu être utilisée, puisque la partie attend toujours son tirage.
    const seed = randomBytes(32).toString("hex");
    await sendWithRetry("Resolve", [String(id), seed], id, async () => {
      const g = await fetchGame(id);
      return !!g && canStillResolve(g);
    });
  });
  return (await fetchGame(id)) ?? game;
}

/** Relaie la révélation d'un joueur. Vérifie d'abord l'empreinte pour ne pas payer de gas pour rien. */
export async function revealGame(id: number, guess: number, salt: string): Promise<Game> {
  assertConfigured();
  if (!Number.isInteger(guess) || guess < 1 || guess > 6) throw new CroupierError("Chiffre invalide.", 400);
  if (!isHex64(salt)) throw new CroupierError("Secret invalide.", 400);
  const game = await fetchGame(id);
  if (!game) throw new CroupierError("Partie introuvable.", 404);
  if (game.status !== "rolled") return game;
  if ((await commitment(game.player, guess, salt)) !== game.commitment) throw new CroupierError("Le chiffre ou le secret ne correspond pas.", 400);

  await serialize(async () => {
    const fresh = await fetchGame(id);
    if (!fresh || fresh.status !== "rolled") return;
    await sendWithRetry("Reveal", [String(id), String(guess), salt], id, async () => (await fetchGame(id))?.status === "rolled");
  });
  return (await fetchGame(id)) ?? game;
}

/** Tire toutes les parties en attente (filet de sécurité si un navigateur s'est fermé). */
export async function sweepPendingGames(): Promise<{ resolved: number; skipped: number }> {
  assertConfigured();
  let resolved = 0;
  let skipped = 0;
  let after = 0;
  for (let page = 0; page < 10; page++) {
    const open = await fetchOpenGames(after);
    if (open.length === 0) break;
    for (const game of open) {
      after = game.id;
      if (!canStillResolve(game)) {
        skipped++;
        continue;
      }
      try {
        const g = await resolveGame(game.id);
        if (g.status !== "pending") resolved++;
      } catch {
        skipped++;
      }
    }
  }
  log("info", "croupier.sweep", { resolved, skipped });
  return { resolved, skipped };
}

/** État du croupier, pour le tableau de bord d'administration. */
export async function croupierStatus() {
  if (!croupierConfigured()) return { configured: false as const };
  const wallet = await getWallet();
  const [address, balance, info] = await Promise.all([wallet.getAddress(), wallet.getBalance("ugnot").catch(() => -1), fetchGameInfo().catch(() => null)]);
  return {
    configured: true as const,
    address,
    balance,
    activeOnContract: info ? info.croupier === address : null,
  };
}
