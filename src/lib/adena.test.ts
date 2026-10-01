import { afterEach, describe, expect, it, vi } from "vitest";
import { connectWallet, friendlyError, sendTransaction, switchToSiteNetwork, WalletError } from "./adena";
import { config } from "./config";
import { playMessage } from "./gnodice";

const PLAYER = "g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrhqa";
const REALM = "gno.land/r/g1vu4h2u5s99g7pz8exlv3dsd2ks3ness2ssq7hl/gnodice";

// Journal d'erreur réel renvoyé par la blockchain quand on rejoue trop tôt.
const COOLDOWN_LOG = `--= Error =--
Data: gnodice: attends encore 10 min 0 s avant de rejouer
Msg Traces:
    0  /gnoroot/tm2/pkg/errors/errors.go:103 - deliver transaction failed: log:msg:0,success:false,log:--= Error =--
Data: errors.FmtError{format:"gnodice: attends encore 10 min 0 s avant de rejouer", args:[]interface {}(nil)}
Stacktrace:
panic: gnodice: attends encore 10 min 0 s avant de rejouer
Play at gno.land/r/g1vu4h2u5s99g7pz8exlv3dsd2ks3ness2ssq7hl/gnodice/gnodice.gno:116`;

const ok = (type: string, data: unknown = {}) => ({ code: 0, status: "success", type, message: "", data });

/** Installe un faux wallet Adena dans `window`. */
function mockAdena(overrides: Record<string, unknown>) {
  const adena = {
    AddEstablish: vi.fn(async () => ok("CONNECTION_SUCCESS")),
    GetAccount: vi.fn(async () => ok("GET_ACCOUNT", { address: PLAYER, coins: "", chainId: config.chainId })),
    SwitchNetwork: vi.fn(async () => ok("SWITCH_NETWORK_SUCCESS")),
    AddNetwork: vi.fn(async () => ok("ADD_NETWORK_SUCCESS")),
    DoContract: vi.fn(),
    On: vi.fn(),
    ...overrides,
  };
  vi.stubGlobal("window", { adena });
  return adena;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("messages d'erreur", () => {
  it("affiche le message du contrat", () => {
    expect(friendlyError(COOLDOWN_LOG)).toBe("Attends encore 10 min 0 s avant de rejouer.");
    expect(friendlyError(JSON.stringify({ log: COOLDOWN_LOG }))).toBe("Attends encore 10 min 0 s avant de rejouer.");
  });

  it("traduit les erreurs courantes du réseau", () => {
    expect(friendlyError("insufficient funds to pay for fees")).toMatch(/Solde insuffisant/);
    expect(friendlyError("out of gas in location: ReadFlat")).toMatch(/gas/);
    expect(friendlyError("address g1x has not signed the required CLA")).toMatch(/CLA/);
    expect(friendlyError("something weird")).toBe("La transaction a échoué. Réessaie dans un instant.");
  });
});

describe("connexion", () => {
  it("accepte un site déjà autorisé", async () => {
    mockAdena({ AddEstablish: vi.fn(async () => ({ code: 4001, status: "failure", type: "ALREADY_CONNECTED", message: "", data: {} })) });
    await expect(connectWallet()).resolves.toEqual({ address: PLAYER, chainId: config.chainId });
  });

  it("signale un refus de connexion", async () => {
    mockAdena({ AddEstablish: vi.fn(async () => ({ code: 4000, status: "failure", type: "CONNECTION_REJECTED", message: "", data: {} })) });
    await expect(connectWallet()).rejects.toMatchObject({ code: "REJECTED" });
  });

  it("ajoute le réseau s'il est inconnu d'Adena, puis bascule dessus", async () => {
    const SwitchNetwork = vi
      .fn()
      .mockResolvedValueOnce({ code: 4000, status: "failure", type: "UNADDED_NETWORK", message: "", data: {} })
      .mockResolvedValueOnce(ok("SWITCH_NETWORK_SUCCESS"));
    const adena = mockAdena({ SwitchNetwork });
    await switchToSiteNetwork();
    expect(adena.AddNetwork).toHaveBeenCalledWith({ chainId: config.chainId, chainName: config.chainName, rpcUrl: config.rpcUrl });
    expect(SwitchNetwork).toHaveBeenCalledTimes(2);
  });
});

describe("envoi d'une transaction", () => {
  const msg = playMessage(PLAYER, "b0ee524a518406c9ca0b10d37962bdd2eb817023959d4896aab9e599afb9e7f2", 5_000_000, REALM);

  it("renvoie la valeur retournée par le contrat", async () => {
    const adena = mockAdena({
      DoContract: vi.fn(async () =>
        ok("TRANSACTION_SENT", {
          hash: "abc",
          height: "42",
          check_tx: { ResponseBase: { Error: null, Data: null, Log: "" } },
          deliver_tx: { ResponseBase: { Error: null, Data: Buffer.from('("roll=4;won=false;payout=0" string)').toString("base64"), Log: "" } },
        }),
      ),
    });
    const tx = await sendTransaction([msg], 15_000_000, 22_500);
    expect(tx).toEqual({ hash: "abc", height: 42, returned: '("roll=4;won=false;payout=0" string)' });
    expect(adena.DoContract).toHaveBeenCalledWith({ messages: [msg], gasFee: 22_500, gasWanted: 15_000_000, memo: "" });
  });

  it("signale une transaction annulée par l'utilisateur", async () => {
    mockAdena({ DoContract: vi.fn(async () => ({ code: 4000, status: "failure", type: "TRANSACTION_REJECTED", message: "", data: null })) });
    const err = await sendTransaction([msg], 1, 1).catch((e) => e);
    expect(err).toBeInstanceOf(WalletError);
    expect(err.code).toBe("REJECTED");
  });

  it("extrait l'erreur du contrat d'une transaction échouée", async () => {
    mockAdena({
      DoContract: vi.fn(async () => ({
        code: 4001,
        status: "failure",
        type: "TRANSACTION_FAILED",
        message: "Transaction failed.",
        data: { deliver_tx: { ResponseBase: { Error: { "@type": "/std.InternalError" }, Data: null, Log: COOLDOWN_LOG } } },
      })),
    });
    await expect(sendTransaction([msg], 1, 1)).rejects.toThrow("Attends encore 10 min 0 s avant de rejouer.");
  });

  it("détecte un échec même si Adena répond « success »", async () => {
    mockAdena({
      DoContract: vi.fn(async () => ok("TRANSACTION_SENT", { deliver_tx: { ResponseBase: { Error: { "@type": "x" }, Data: null, Log: COOLDOWN_LOG } } })),
    });
    await expect(sendTransaction([msg], 1, 1)).rejects.toThrow("Attends encore 10 min 0 s avant de rejouer.");
  });

  it("explique quoi faire si Adena n'est pas installé", async () => {
    vi.stubGlobal("window", {});
    await expect(sendTransaction([msg], 1, 1)).rejects.toMatchObject({ code: "NO_EXTENSION" });
  });
});
