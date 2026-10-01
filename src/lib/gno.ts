// Lecture de la blockchain Gno via son API RPC.
//
// Ces requêtes sont gratuites : elles ne créent pas de transaction et ne
// demandent aucune signature. On appelle les fonctions de lecture du contrat
// (GetInfoJSON, GetPlayerJSON) avec la requête "vm/qeval_json".

import { config } from "./config";
import { parseUgnot } from "./format";

// --- Types renvoyés par le contrat (voir contract/gnodice/api.gno) ---

/** Étapes d'une partie (voir contract/gnodice/gnodice.gno). */
export type GameStatus = "pending" | "rolled" | "won" | "lost" | "refunded" | "expired";

export type Game = {
  id: number;
  player: string;
  status: GameStatus;
  commitment: string; // empreinte du chiffre caché
  seed: string; // graine du croupier (vide avant le tirage)
  guess: number; // 0 tant que le chiffre est caché
  roll: number; // 0 avant le tirage
  bet: number; // ugnot
  payout: number; // ugnot
  won: boolean;
  time: number; // secondes Unix (heure du bloc de la mise)
  height: number;
  rolledAt: number;
  settledAt: number;
  resolveDeadline: number; // après cette heure, la mise peut être remboursée
};

export type GameInfo = {
  owner: string;
  pendingOwner: string;
  croupier: string;
  realm: string;
  paused: boolean;
  bankroll: number;
  reserved: number;
  available: number;
  maxCoverableBet: number;
  minBet: number;
  maxBet: number;
  multiplier: number;
  cooldown: number;
  historySize: number;
  resolveTimeout: number;
  revealWindow: number;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  totalRefunded: number;
  totalExpired: number;
  totalWagered: number;
  totalPaid: number;
  totalFunded: number;
  totalWithdrawn: number;
  openGames: number;
  dailyPayoutLimit: number;
  payoutToday: number;
  lowBankroll: number;
  now: number;
  recent: Game[];
};

export type PlayerInfo = {
  address: string;
  played: number;
  wins: number;
  wagered: number;
  paid: number;
  lastPlay: number;
  nextPlayAt: number;
  cooldownRemaining: number;
  blocked: boolean;
  now: number;
  /** Parties en cours (en attente de tirage ou de révélation). */
  open: Game[];
  history: Game[];
};

export type PackageStatus = "absent" | "inert" | "live";

export class GnoQueryError extends Error {
  /** Type d'erreur renvoyé par le nœud, par ex. "/vm.InvalidPkgPathError". */
  readonly type?: string;
  /** true pour une panne passagère (réseau, serveur) qui mérite un nouvel essai. */
  readonly retryable: boolean;
  constructor(message: string, type?: string, retryable = false) {
    super(message);
    this.type = type;
    this.retryable = retryable;
  }
}

// --- Validation (on ne met jamais de texte libre dans une requête) ---

// Une adresse Gno : "g1" + 38 caractères de l'alphabet bech32.
const ADDRESS_RE = /^g1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38}$/;
// Un chemin de contrat : gno.land/r/...
const REALM_RE = /^gno\.land\/r\/[a-z0-9_.\-/]+$/;

export function isValidAddress(address: string): boolean {
  return ADDRESS_RE.test(address);
}

export function isValidRealmPath(path: string): boolean {
  return REALM_RE.test(path) && !path.includes("//") && !path.endsWith("/");
}

// --- Encodage base64 compatible UTF-8 ---

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// --- Requête de base ---

type AbciResponse = {
  result?: {
    response?: {
      ResponseBase?: {
        Error: { "@type"?: string } | null;
        Data: string | null;
        Log: string;
      };
    };
  };
  error?: { message?: string; data?: string };
};

// Fiabilité : chaque requête a un délai maximal, et les pannes réseau
// (pas les erreurs du contrat) sont retentées avec une attente croissante.
const QUERY_TIMEOUT_MS = 8_000;
const RETRY_DELAYS_MS = [400, 1_200];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Une erreur réseau ou serveur (5xx) mérite un nouvel essai ; une erreur du contrat, non. */
function isRetryable(e: unknown): boolean {
  return e instanceof GnoQueryError && e.retryable === true;
}

/** Envoie une requête "abci_query" au nœud RPC et renvoie la réponse décodée. */
export async function abciQuery(path: string, data: string, rpcUrl = config.rpcUrl): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await abciQueryOnce(path, data, rpcUrl);
    } catch (e) {
      if (!isRetryable(e) || attempt >= RETRY_DELAYS_MS.length) throw e;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function abciQueryOnce(path: string, data: string, rpcUrl: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(rpcUrl, {
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "abci_query",
        params: { path, data: toBase64(data) },
      }),
      cache: "no-store",
    });
  } catch {
    throw new GnoQueryError("Impossible de joindre le réseau Gno. Vérifie ta connexion.", undefined, true);
  }
  if (!res.ok) throw new GnoQueryError(`Le nœud Gno a répondu avec l'erreur ${res.status}.`, undefined, res.status >= 500);

  const json = (await res.json()) as AbciResponse;
  if (json.error) throw new GnoQueryError(json.error.data || json.error.message || "Erreur RPC.");

  const base = json.result?.response?.ResponseBase;
  if (!base) throw new GnoQueryError("Réponse inattendue du nœud Gno.");
  if (base.Error) {
    // Le message utile est sur la ligne "... - <message>" du journal d'erreur.
    const line = base.Log?.split("\n").find((l) => l.includes(" - "));
    throw new GnoQueryError(line?.split(" - ").pop()?.trim() || "Erreur de requête.", base.Error["@type"]);
  }
  return base.Data ? fromBase64(base.Data) : "";
}

type QevalJsonResult = { T?: unknown; V?: { "@type"?: string; value?: string } };

/**
 * Évalue une expression du contrat qui renvoie une chaîne (string), par ex.
 * gno.land/r/.../gnodice.GetInfoJSON(), et renvoie cette chaîne.
 */
async function evalString(expression: string): Promise<string> {
  const raw = await abciQuery("vm/qeval_json", expression);
  const parsed = JSON.parse(raw) as QevalJsonResult[] | { results?: QevalJsonResult[] };
  // Selon la version du nœud, la réponse est un tableau ou {"results": [...]}.
  const results = Array.isArray(parsed) ? parsed : parsed.results;
  const value = results?.[0]?.V;
  if (value?.["@type"] !== "/gno.StringValue" || typeof value.value !== "string") {
    throw new GnoQueryError("Le contrat a renvoyé une valeur inattendue.");
  }
  return value.value;
}

function requireRealm(realmPath: string) {
  if (!isValidRealmPath(realmPath)) {
    throw new GnoQueryError("Chemin du contrat invalide ou non configuré.");
  }
}

// --- Lectures du contrat GNO-DICE ---

export async function fetchGameInfo(realmPath = config.realmPath): Promise<GameInfo> {
  requireRealm(realmPath);
  return JSON.parse(await evalString(`${realmPath}.GetInfoJSON()`)) as GameInfo;
}

export async function fetchPlayer(address: string, realmPath = config.realmPath): Promise<PlayerInfo> {
  requireRealm(realmPath);
  if (!isValidAddress(address)) throw new GnoQueryError("Adresse de joueur invalide.");
  const json = JSON.parse(await evalString(`${realmPath}.GetPlayerJSON("${address}")`));
  if (json.error) throw new GnoQueryError(json.error);
  return json as PlayerInfo;
}

/** Une partie, ou null si elle n'existe pas. */
export async function fetchGame(id: number, realmPath = config.realmPath): Promise<Game | null> {
  requireRealm(realmPath);
  if (!Number.isSafeInteger(id) || id < 1) throw new GnoQueryError("Numéro de partie invalide.");
  const json = JSON.parse(await evalString(`${realmPath}.GetGameJSON(${id})`));
  return json.error ? null : (json as Game);
}

/** Parties en cours (50 au plus), après le numéro `after`. */
export async function fetchOpenGames(after = 0, realmPath = config.realmPath): Promise<Game[]> {
  requireRealm(realmPath);
  if (!Number.isSafeInteger(after) || after < 0) throw new GnoQueryError("Numéro de partie invalide.");
  return JSON.parse(await evalString(`${realmPath}.GetOpenGamesJSON(${after})`)) as Game[];
}

// --- Autres lectures utiles ---

/** Solde en ugnot d'une adresse. */
export async function fetchBalance(address: string): Promise<number> {
  if (!isValidAddress(address)) return 0;
  const raw = await abciQuery(`bank/balances/${address}`, "");
  // La réponse est une chaîne JSON, par ex. "12345ugnot".
  const coins = raw ? (JSON.parse(raw) as string) : "";
  return parseUgnot(coins);
}

/** Prix actuel du gas, en ugnot par unité de gas. */
export async function fetchGasPrice(): Promise<number> {
  try {
    const raw = await abciQuery("auth/gasprice", "");
    const { gas, price } = JSON.parse(raw) as { gas: string; price: string };
    const perGas = parseUgnot(price) / Number(gas);
    return Number.isFinite(perGas) && perGas > 0 ? perGas : 0.001;
  } catch {
    return 0.001; // valeur du réseau au 30/09/2026 : 1 ugnot pour 1000 gas
  }
}

/** Frais (en ugnot) à proposer pour une transaction qui demande `gasWanted`. */
export async function estimateFee(gasWanted: number): Promise<number> {
  const price = await fetchGasPrice();
  // +50 % de marge si le prix monte entre-temps, et au moins 0,01 GNOT.
  return Math.max(10_000, Math.ceil(gasWanted * price * 1.5));
}

/** État d'un paquet : absent, "inert" (en attente d'activation) ou "live". */
export async function fetchPackageStatus(path: string): Promise<{ status: PackageStatus; reason?: string; creator?: string }> {
  const raw = await abciQuery("vm/qpkgmeta_json", path);
  return JSON.parse(raw);
}

/** Vérifie si une adresse a signé le CLA requis pour déployer (true si non requis). */
export async function fetchHasSignedCLA(address: string): Promise<boolean> {
  if (!isValidAddress(address)) return false;
  try {
    const raw = await abciQuery("vm/qeval", `gno.land/r/sys/cla.HasValidSignature("${address}")`);
    return raw.includes("true");
  } catch {
    return true; // contrat CLA absent : pas d'obligation
  }
}
