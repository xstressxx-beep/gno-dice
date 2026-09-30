import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateFee, fetchBalance, fetchGameInfo, fetchPlayer, GnoQueryError, isValidAddress, isValidRealmPath } from "./gno";

const REALM = "gno.land/r/g1vu4h2u5s99g7pz8exlv3dsd2ks3ness2ssq7hl/gnodice";
const PLAYER = "g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrhqa";

/** Simule la réponse JSON-RPC d'un nœud Gno. */
function rpcResponse(data: string | null, error?: { type: string; log: string }) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        response: {
          ResponseBase: {
            Error: error ? { "@type": error.type } : null,
            Data: data === null ? null : Buffer.from(data).toString("base64"),
            Events: null,
            Log: error?.log ?? "",
          },
        },
      },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validation", () => {
  it("reconnaît une adresse Gno", () => {
    expect(isValidAddress(PLAYER)).toBe(true);
    expect(isValidAddress("g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrhq")).toBe(false); // trop courte
    expect(isValidAddress("G1JGPS44VJLQ34UN3LYCHJ3V3FG6AQAPXM0LRHQA")).toBe(false); // majuscules
    expect(isValidAddress('g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrh")')).toBe(false); // tentative d'injection
  });

  it("reconnaît un chemin de contrat", () => {
    expect(isValidRealmPath(REALM)).toBe(true);
    expect(isValidRealmPath("gno.land/p/nt/avl/v0")).toBe(false); // un paquet, pas un contrat
    expect(isValidRealmPath('gno.land/r/x".Foo()')).toBe(false);
    expect(isValidRealmPath("gno.land/r/x/")).toBe(false);
    expect(isValidRealmPath("")).toBe(false);
  });
});

describe("lecture du contrat", () => {
  // Réponse réelle de vm/qeval_json (capturée sur une chaîne locale).
  const infoJson =
    '{"owner":"g1vu4h2u5s99g7pz8exlv3dsd2ks3ness2ssq7hl","realm":"g19xf6nj5rje4mfa2hxu9a4fx4q4w9g9ay78q6qf","paused":false,"bankroll":0,"maxCoverableBet":0,"minBet":1000000,"maxBet":10000000,"multiplier":5,"cooldown":600,"historySize":10,"totalGames":0,"totalWins":0,"totalWagered":0,"totalPaid":0,"totalFunded":0,"now":1790797595,"recent":[]}';
  const stringValue = (s: string) => ({ T: { "@type": "/gno.PrimitiveType", value: "16" }, V: { "@type": "/gno.StringValue", value: s } });

  it("lit GetInfoJSON (format {results: [...]})", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      rpcResponse(JSON.stringify({ results: [stringValue(infoJson)] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const info = await fetchGameInfo(REALM);
    expect(info.owner).toBe("g1vu4h2u5s99g7pz8exlv3dsd2ks3ness2ssq7hl");
    expect(info.cooldown).toBe(600);
    expect(info.multiplier).toBe(5);

    // La requête envoyée est bien vm/qeval_json avec l'expression encodée en base64.
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.method).toBe("abci_query");
    expect(body.params.path).toBe("vm/qeval_json");
    expect(Buffer.from(body.params.data, "base64").toString()).toBe(`${REALM}.GetInfoJSON()`);
  });

  it("lit GetInfoJSON (ancien format en tableau)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse(JSON.stringify([stringValue(infoJson)]))));
    expect((await fetchGameInfo(REALM)).minBet).toBe(1_000_000);
  });

  it("lit l'historique d'un joueur", async () => {
    const playerJson =
      '{"address":"g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrhqa","played":1,"wins":0,"wagered":5000000,"paid":0,"lastPlay":1790797640,"nextPlayAt":1790798240,"cooldownRemaining":600,"now":1790797640,"history":[{"id":1,"player":"g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrhqa","guess":3,"roll":4,"bet":5000000,"payout":0,"won":false,"time":1790797640,"height":23}]}';
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse(JSON.stringify({ results: [stringValue(playerJson)] }))));
    const player = await fetchPlayer(PLAYER, REALM);
    expect(player.history).toHaveLength(1);
    expect(player.history[0]).toMatchObject({ guess: 3, roll: 4, won: false, bet: 5_000_000 });
  });

  it("refuse une adresse invalide sans interroger le réseau", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPlayer('x") + evil("', REALM)).rejects.toBeInstanceOf(GnoQueryError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("transforme une erreur du nœud en message lisible", async () => {
    const log =
      "--= Error =--\nData: vm.InvalidPkgPathError{abciError:vm.abciError{}}\nMsg Traces:\n    0  /gnoroot/gno.land/pkg/sdk/vm/errors.go:88 - package not found: gno.land/r/x/gnodice\nStack Trace:\n";
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse(null, { type: "/vm.InvalidPkgPathError", log })));
    const err = await fetchGameInfo("gno.land/r/x/gnodice").catch((e) => e);
    expect(err).toBeInstanceOf(GnoQueryError);
    expect(err.message).toBe("package not found: gno.land/r/x/gnodice");
    expect(err.type).toBe("/vm.InvalidPkgPathError");
  });
});

describe("solde et frais", () => {
  it("lit le solde (format réel de bank/balances)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse('"999994462600ugnot"')));
    expect(await fetchBalance(PLAYER)).toBe(999994462600);
  });

  it("solde nul pour un compte inconnu", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse('""')));
    expect(await fetchBalance(PLAYER)).toBe(0);
  });

  it("calcule les frais depuis le prix du gas du réseau", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse('{"gas":"1000","price":"1ugnot"}')));
    expect(await estimateFee(15_000_000)).toBe(22_500); // 15 M × 0,001 × 1,5
    expect(await estimateFee(1_000)).toBe(10_000); // minimum 0,01 GNOT
  });

  it("garde un prix par défaut si le réseau ne répond pas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await estimateFee(80_000_000)).toBe(120_000);
  });
});
