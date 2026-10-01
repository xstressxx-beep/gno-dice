// Tests du croupier (serveur) avec une fausse blockchain et un faux wallet :
// on vérifie qu'il n'envoie une transaction que lorsqu'elle est utile, qu'il
// ne réessaie que sur les pannes passagères, et qu'il ne gaspille pas de gas.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Game } from "@/lib/gno";

const SALT = "2f683125c961cde12579ea12f7ae964c2cfe0d21bb3ca0ab90aeb92528d00575";
const ALICE = "g1v9kxjcm9ta047h6lta047h6lta047h6lzd40gh";
const COMMIT = "b0ee524a518406c9ca0b10d37962bdd2eb817023959d4896aab9e599afb9e7f2"; // chiffre 3

// --- Fausse blockchain ---
const chain = { games: new Map<number, Game>() };
vi.mock("@/lib/gno", () => ({
  fetchGame: vi.fn(async (id: number) => {
    const g = chain.games.get(id);
    return g ? { ...g } : null;
  }),
  fetchOpenGames: vi.fn(async (after: number) => [...chain.games.values()].filter((g) => g.id > after && (g.status === "pending" || g.status === "rolled"))),
  fetchGameInfo: vi.fn(async () => ({ croupier: "g1croupier" })),
  estimateFee: vi.fn(async () => 15_000),
}));

// --- Faux wallet du croupier ---
const callMethod = vi.fn();
vi.mock("@gnolang/gno-js-client", () => ({
  GnoWallet: { fromMnemonic: vi.fn(async () => ({ connect: vi.fn(), callMethod, getAddress: async () => "g1croupier", getBalance: async () => 1_000_000 })) },
  GnoJSONRPCProvider: { create: vi.fn(async () => ({})) },
}));
vi.mock("@gnolang/tm2-js-client", () => ({ TransactionEndpoint: { BROADCAST_TX_COMMIT: "broadcast_tx_commit" } }));
vi.mock("./log", () => ({ log: vi.fn() }));

const ok = { hash: "ABC", check_tx: { ResponseBase: { Error: null } }, deliver_tx: { ResponseBase: { Error: null } } };

function game(over: Partial<Game> = {}): Game {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 1,
    player: ALICE,
    status: "pending",
    commitment: COMMIT,
    seed: "",
    guess: 0,
    roll: 0,
    bet: 1_000_000,
    payout: 0,
    won: false,
    time: now,
    height: 10,
    rolledAt: 0,
    settledAt: 0,
    resolveDeadline: now + 1800,
    ...over,
  };
}

beforeEach(() => {
  vi.resetModules();
  callMethod.mockReset();
  chain.games.clear();
  process.env.CROUPIER_MNEMONIC = "test test test test test test test test test test test junk";
});

async function load() {
  return import("./croupier");
}

describe("croupier : tirage", () => {
  it("tire le dé d'une partie en attente avec une graine de 32 octets", async () => {
    chain.games.set(1, game());
    callMethod.mockImplementation(async (_path: string, method: string, args: string[]) => {
      expect(method).toBe("Resolve");
      expect(args[0]).toBe("1");
      expect(args[1]).toMatch(/^[0-9a-f]{64}$/);
      chain.games.set(1, game({ status: "rolled", roll: 4, seed: args[1] }));
      return ok;
    });
    const { resolveGame } = await load();
    const g = await resolveGame(1);
    expect(g.status).toBe("rolled");
    expect(callMethod).toHaveBeenCalledTimes(1);
  });

  it("n'envoie rien si la partie est déjà tirée (idempotent)", async () => {
    chain.games.set(1, game({ status: "rolled", roll: 2 }));
    const { resolveGame } = await load();
    expect((await resolveGame(1)).roll).toBe(2);
    expect(callMethod).not.toHaveBeenCalled();
  });

  it("ne tire pas une partie trop proche de la limite (elle doit être remboursée)", async () => {
    chain.games.set(1, game({ resolveDeadline: Math.floor(Date.now() / 1000) + 5 }));
    const { resolveGame } = await load();
    await resolveGame(1);
    expect(callMethod).not.toHaveBeenCalled();
  });

  it("réessaie sur une panne réseau, pas sur une erreur du contrat", async () => {
    chain.games.set(1, game());
    callMethod.mockRejectedValueOnce(new Error("fetch failed")).mockImplementationOnce(async () => {
      chain.games.set(1, game({ status: "rolled", roll: 6 }));
      return ok;
    });
    const { resolveGame } = await load();
    expect((await resolveGame(1)).status).toBe("rolled");
    expect(callMethod).toHaveBeenCalledTimes(2);

    chain.games.set(2, game({ id: 2 }));
    callMethod.mockReset();
    callMethod.mockResolvedValue({ ...ok, deliver_tx: { ResponseBase: { Error: {}, Log: "gnodice: seul le croupier peut tirer les dés" } } });
    await expect(resolveGame(2)).rejects.toThrow("La transaction du croupier a échoué.");
    expect(callMethod).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("ne renvoie pas la transaction si le premier essai avait en fait réussi", async () => {
    chain.games.set(1, game());
    callMethod.mockImplementationOnce(async () => {
      chain.games.set(1, game({ status: "rolled", roll: 1 })); // le tirage a eu lieu…
      throw new Error("timeout"); // …mais la réponse s'est perdue
    });
    const { resolveGame } = await load();
    expect((await resolveGame(1)).status).toBe("rolled");
    expect(callMethod).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("refuse une partie inconnue", async () => {
    const { resolveGame } = await load();
    await expect(resolveGame(99)).rejects.toThrow("Partie introuvable.");
  });

  it("refuse de fonctionner sans phrase secrète configurée", async () => {
    delete process.env.CROUPIER_MNEMONIC;
    chain.games.set(1, game());
    const { resolveGame, croupierConfigured } = await load();
    expect(croupierConfigured()).toBe(false);
    await expect(resolveGame(1)).rejects.toThrow("Croupier non configuré");
  });
});

describe("croupier : révélation relayée", () => {
  it("relaie une révélation valide", async () => {
    chain.games.set(1, game({ status: "rolled", roll: 3 }));
    callMethod.mockImplementation(async (_p: string, method: string, args: string[]) => {
      expect(method).toBe("Reveal");
      expect(args).toEqual(["1", "3", SALT]);
      chain.games.set(1, game({ status: "won", roll: 3, guess: 3, won: true, payout: 5_000_000 }));
      return ok;
    });
    const { revealGame } = await load();
    expect((await revealGame(1, 3, SALT)).status).toBe("won");
  });

  it("refuse un mauvais chiffre ou secret SANS envoyer de transaction (pas de gas gaspillé)", async () => {
    chain.games.set(1, game({ status: "rolled", roll: 3 }));
    const { revealGame } = await load();
    await expect(revealGame(1, 4, SALT)).rejects.toThrow("ne correspond pas");
    await expect(revealGame(1, 3, "a".repeat(64))).rejects.toThrow("ne correspond pas");
    await expect(revealGame(1, 3, "court")).rejects.toThrow("Secret invalide.");
    await expect(revealGame(1, 9, SALT)).rejects.toThrow("Chiffre invalide.");
    expect(callMethod).not.toHaveBeenCalled();
  });

  it("n'envoie rien si la partie n'est pas au bon stade", async () => {
    chain.games.set(1, game({ status: "pending" }));
    chain.games.set(2, game({ id: 2, status: "won" }));
    const { revealGame } = await load();
    await revealGame(1, 3, SALT);
    await revealGame(2, 3, SALT);
    expect(callMethod).not.toHaveBeenCalled();
  });
});

describe("croupier : balayage", () => {
  it("tire toutes les parties en attente encore dans les temps", async () => {
    const now = Math.floor(Date.now() / 1000);
    chain.games.set(1, game({ id: 1 }));
    chain.games.set(2, game({ id: 2, resolveDeadline: now - 1 })); // trop tard : remboursable
    chain.games.set(3, game({ id: 3 }));
    callMethod.mockImplementation(async (_p: string, _m: string, args: string[]) => {
      const id = Number(args[0]);
      chain.games.set(id, game({ id, status: "rolled", roll: 2 }));
      return ok;
    });
    const { sweepPendingGames } = await load();
    expect(await sweepPendingGames()).toEqual({ resolved: 2, skipped: 1 });
  });
});
