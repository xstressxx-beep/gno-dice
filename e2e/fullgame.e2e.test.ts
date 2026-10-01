// Test de bout en bout sur une VRAIE blockchain Gno locale (gnodev), avec de
// vraies transactions signées : le joueur mise, le croupier du site tire le
// dé, la révélation est relayée, le contrat paie. Puis plusieurs joueurs en
// même temps, et des tentatives de triche refusées par la chaîne.
//
// Lancement (voir README, section « Tests ») :
//   gnodev local -paths gno.land/r/example/gnodice -empty-blocks -add-account <joueur>=...
//   npm run test:e2e

import { beforeAll, describe, expect, it } from "vitest";
import { GnoJSONRPCProvider, GnoWallet } from "@gnolang/gno-js-client";
import { TransactionEndpoint } from "@gnolang/tm2-js-client";
import { commitment, randomHex32, rollFor } from "@/lib/fairness";
import { fetchGame, fetchGameInfo } from "@/lib/gno";
import { resolveGame, revealGame, sweepPendingGames } from "@/lib/server/croupier";

const RPC = process.env.NEXT_PUBLIC_GNO_RPC_URL!;
const REALM = process.env.NEXT_PUBLIC_GNODICE_REALM!;
const OWNER_MNEMONIC = process.env.CROUPIER_MNEMONIC!; // test1 de gnodev : propriétaire ET croupier
const G = 1_000_000;
const FEE = { gas_wanted: BigInt(30_000_000), gas_fee: "30000ugnot" };

type Tx = { deliver_tx?: { ResponseBase?: { Data?: string | null; Error?: unknown; Log?: string } } };

async function wallet(mnemonic: string) {
  const w = await GnoWallet.fromMnemonic(mnemonic, { addressPrefix: "g" });
  w.connect(await GnoJSONRPCProvider.create(RPC));
  return w;
}

/** Un joueur tout neuf (pas de cooldown en cours), alimenté par le propriétaire. */
async function freshPlayer(gnot = 30) {
  const w = await GnoWallet.createRandom({ addressPrefix: "g" });
  w.connect(await GnoJSONRPCProvider.create(RPC));
  await owner.transferFunds(await w.getAddress(), new Map([["ugnot", gnot * G]]), TransactionEndpoint.BROADCAST_TX_COMMIT, FEE);
  return w;
}

function returned(tx: Tx): string {
  const data = tx.deliver_tx?.ResponseBase?.Data;
  return data ? Buffer.from(data, "base64").toString("utf8") : "";
}

async function play(w: GnoWallet, guess: number, bet: number) {
  const salt = randomHex32();
  const player = await w.getAddress();
  const commit = await commitment(player, guess, salt);
  const tx = (await w.callMethod(REALM, "Play", [commit], TransactionEndpoint.BROADCAST_TX_COMMIT, new Map([["ugnot", bet]]), undefined, FEE)) as Tx;
  const id = Number(/id=(\d+)/.exec(returned(tx))?.[1]);
  expect(id).toBeGreaterThan(0);
  return { id, salt, commit, player };
}

/** Une transaction qui doit être refusée par le contrat, avec ce message. */
async function expectRejected(promise: Promise<unknown>, message: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  const text = err ? String(err instanceof Error ? err.message : err) + JSON.stringify(err) : "";
  expect(err, "la transaction aurait dû être refusée").not.toBeNull();
  expect(text).toContain(message);
}

let owner: GnoWallet;

beforeAll(async () => {
  owner = await wallet(OWNER_MNEMONIC);
  // La banque reçoit 1 000 GNOT
  await owner.callMethod(REALM, "Fund", [], TransactionEndpoint.BROADCAST_TX_COMMIT, new Map([["ugnot", 1_000 * G]]), undefined, FEE);
}, 120_000);

describe("partie complète sur une vraie chaîne", () => {
  it("mise cachée -> tirage du croupier -> révélation relayée -> paiement exact", async () => {
    const player = await freshPlayer();
    const before = await player.getBalance("ugnot");
    const bet = 10 * G;
    const guess = 3;
    const { id, salt, commit } = await play(player, guess, bet);

    // Juste après la mise : aucun dé, chiffre caché
    const placed = await fetchGame(id);
    expect(placed?.status).toBe("pending");
    expect(placed?.roll).toBe(0);
    expect(placed?.guess).toBe(0);
    expect(placed?.commitment).toBe(commit);

    // Le croupier du site tire le dé
    const rolled = await resolveGame(id);
    expect(rolled.status).toBe("rolled");
    expect(rolled.seed).toMatch(/^[0-9a-f]{64}$/);
    // Vérification indépendante, comme le fait le navigateur
    expect(await rollFor(rolled.seed, rolled.commitment, id)).toBe(rolled.roll);

    // Révélation relayée (aucune 2e signature du joueur)
    const settled = await revealGame(id, guess, salt);
    const won = rolled.roll === guess;
    expect(settled.status).toBe(won ? "won" : "lost");
    expect(settled.guess).toBe(guess);

    // Paiement exact par le contrat
    expect(settled.payout).toBe(won ? bet * 5 : 0);
    // Solde du joueur : - mise - frais + gain éventuel - dépôt de stockage de la chaîne
    const after = await player.getBalance("ugnot");
    const deposit = -(after - before) - bet - 30_000 + (won ? bet * 5 : 0);
    console.log(`dépôt de stockage de la 1re partie : ${deposit / G} GNOT`);
    expect(deposit).toBeGreaterThanOrEqual(0);
    expect(deposit).toBeLessThan(G);
  }, 120_000);

  it("refuse sur la chaîne : tirer son propre dé, changer de chiffre, payer deux fois", async () => {
    const player = await freshPlayer();
    const { id, salt } = await play(player, 5, G);
    await expectRejected(player.callMethod(REALM, "Resolve", [String(id), randomHex32()], TransactionEndpoint.BROADCAST_TX_COMMIT, undefined, undefined, FEE), "seul le croupier");
    const rolled = await resolveGame(id);
    const other = rolled.roll === 5 ? 6 : rolled.roll; // le chiffre qui aurait gagné, si différent
    if (other !== 5) {
      await expectRejected(
        player.callMethod(REALM, "Reveal", [String(id), String(other), salt], TransactionEndpoint.BROADCAST_TX_COMMIT, undefined, undefined, FEE),
        "ne correspond pas",
      );
    }
    await revealGame(id, 5, salt);
    await expectRejected(
      player.callMethod(REALM, "Reveal", [String(id), "5", salt], TransactionEndpoint.BROADCAST_TX_COMMIT, undefined, undefined, FEE),
      "ne peut pas être dévoilée",
    );
  }, 120_000);
});

describe("plusieurs joueurs en même temps", () => {
  it("8 joueurs misent en parallèle ; le croupier tire tout dans l'ordre ; la comptabilité est exacte", async () => {
    const infoBefore = await fetchGameInfo();
    // 8 nouveaux comptes, alimentés par le propriétaire
    const players = [];
    for (let i = 0; i < 8; i++) players.push(await freshPlayer(20));

    // Mises simultanées
    const games = await Promise.all(players.map((p, i) => play(p, (i % 6) + 1, G + i * 100_000)));
    expect(new Set(games.map((g) => g.id)).size).toBe(8);

    // Le balayage du croupier tire toutes les parties (transactions en file : pas de conflit de séquence)
    const sweep = await sweepPendingGames();
    expect(sweep.resolved).toBe(8);

    // Révélations relayées, elles aussi en parallèle
    const settled = await Promise.all(games.map((g, i) => revealGame(g.id, (i % 6) + 1, g.salt)));
    for (const g of settled) expect(["won", "lost"]).toContain(g.status);

    const info = await fetchGameInfo();
    const wagered = games.reduce((s, _g, i) => s + G + i * 100_000, 0);
    const paid = settled.reduce((s, g) => s + g.payout, 0);
    expect(info.reserved).toBe(infoBefore.reserved);
    expect(info.totalWagered - infoBefore.totalWagered).toBe(wagered);
    expect(info.totalPaid - infoBefore.totalPaid).toBe(paid);
    expect(info.bankroll - infoBefore.bankroll).toBe(wagered - paid);
  }, 300_000);
});
