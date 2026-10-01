import { describe, expect, it } from "vitest";
import type { Game, GameInfo } from "./gno";
import { computeAlerts, computeStats } from "./monitoring";

const G = 1_000_000;

function info(over: Partial<GameInfo> = {}): GameInfo {
  return {
    owner: "g1owner",
    pendingOwner: "",
    croupier: "g1croupier",
    realm: "g1realm",
    paused: false,
    bankroll: 500 * G,
    reserved: 0,
    available: 500 * G,
    maxCoverableBet: 10 * G,
    minBet: G,
    maxBet: 10 * G,
    multiplier: 5,
    cooldown: 600,
    historySize: 10,
    resolveTimeout: 1800,
    revealWindow: 604800,
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    totalRefunded: 0,
    totalExpired: 0,
    totalWagered: 0,
    totalPaid: 0,
    totalFunded: 500 * G,
    totalWithdrawn: 0,
    openGames: 0,
    dailyPayoutLimit: 500 * G,
    payoutToday: 0,
    lowBankroll: 100 * G,
    now: 1_800_000_000,
    recent: [],
    ...over,
  };
}

const okCroupier = { configured: true as const, address: "g1croupier", balance: 5 * G, activeOnContract: true };
const titles = (a: { title: string }[]) => a.map((x) => x.title);

describe("surveillance", () => {
  it("aucune alerte quand tout va bien", () => {
    expect(computeAlerts(info(), okCroupier, [], 1_800_000_000)).toEqual([]);
  });

  it("signale le coupe-circuit et la pause", () => {
    expect(titles(computeAlerts(info({ paused: true, payoutToday: 500 * G }), okCroupier, [], 0))).toContain("Coupe-circuit déclenché");
    expect(titles(computeAlerts(info({ paused: true }), okCroupier, [], 0))).toContain("Jeu en pause");
  });

  it("signale un croupier absent, inactif ou à court de gas", () => {
    expect(titles(computeAlerts(info(), { configured: false }, [], 0))).toContain("Croupier non configuré");
    expect(titles(computeAlerts(info(), { ...okCroupier, activeOnContract: false }, [], 0))).toContain("Le contrat attend un autre croupier");
    expect(titles(computeAlerts(info(), { ...okCroupier, balance: 100_000 }, [], 0))).toContain("Croupier presque à court de gas");
  });

  it("signale une banque basse et la mise max non couverte", () => {
    const t = titles(computeAlerts(info({ available: 20 * G, maxCoverableBet: 5 * G }), okCroupier, [], 0));
    expect(t).toContain("Banque basse");
    expect(t).toContain("La mise maximale n'est plus acceptée");
  });

  it("signale les parties bloquées", () => {
    const pending = { id: 7, status: "pending", resolveDeadline: 100 } as Game;
    expect(titles(computeAlerts(info(), okCroupier, [pending], 200))).toContain("1 partie(s) non tirée(s) à temps");
  });

  it("détecte un taux de victoire anormal (croupier compromis)", () => {
    const suspicious = info({ totalWins: 60, totalLosses: 60, totalWagered: 120 * G, totalPaid: 300 * G });
    expect(titles(computeAlerts(suspicious, okCroupier, [], 0))).toContain("Taux de victoire anormalement élevé");
    // Un taux normal (≈ 1/6) ne déclenche rien
    const normal = info({ totalWins: 20, totalLosses: 100, totalWagered: 120 * G, totalPaid: 100 * G });
    expect(titles(computeAlerts(normal, okCroupier, [], 0))).not.toContain("Taux de victoire anormalement élevé");
  });

  it("calcule le taux de victoire et le taux de retour", () => {
    const s = computeStats(info({ totalWins: 1, totalLosses: 5, totalWagered: 6 * G, totalPaid: 5 * G }));
    expect(s.settled).toBe(6);
    expect(s.winRate).toBeCloseTo(1 / 6);
    expect(s.rtp).toBeCloseTo(5 / 6);
  });
});
