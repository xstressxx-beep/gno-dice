import { describe, expect, it } from "vitest";
import { deployMessage, fundMessage, parsePlayId, parsePlayResult, playMessage, realmPathFor, refundMessage, revealMessage } from "./gnodice";

const PLAYER = "g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrhqa";
const REALM = "gno.land/r/g1vu4h2u5s99g7pz8exlv3dsd2ks3ness2ssq7hl/gnodice";
const COMMIT = "b0ee524a518406c9ca0b10d37962bdd2eb817023959d4896aab9e599afb9e7f2";
const SALT = "2f683125c961cde12579ea12f7ae964c2cfe0d21bb3ca0ab90aeb92528d00575";

describe("messages de transaction", () => {
  it("prépare une mise sur un chiffre caché (seule l'empreinte est envoyée)", () => {
    expect(playMessage(PLAYER, COMMIT, 10_000_000, REALM)).toEqual({
      type: "/vm.m_call",
      value: { caller: PLAYER, send: "10000000ugnot", max_deposit: "", pkg_path: REALM, func: "Play", args: [COMMIT] },
    });
  });

  it("prépare la révélation et le remboursement", () => {
    expect(revealMessage(PLAYER, 42, 3, SALT, REALM)).toEqual({
      type: "/vm.m_call",
      value: { caller: PLAYER, send: "", max_deposit: "", pkg_path: REALM, func: "Reveal", args: ["42", "3", SALT] },
    });
    const refund = refundMessage(PLAYER, 42, REALM);
    if (refund.type === "/vm.m_call") expect(refund.value.args).toEqual(["42"]);
  });

  it("prépare l'alimentation de la banque", () => {
    const msg = fundMessage(PLAYER, 50_000_000, REALM);
    expect(msg.type).toBe("/vm.m_call");
    if (msg.type === "/vm.m_call") {
      expect(msg.value.func).toBe("Fund");
      expect(msg.value.send).toBe("50000000ugnot");
      expect(msg.value.args).toEqual([]);
    }
  });

  it("prépare le déploiement avec un gnomod.toml au bon chemin et des fichiers triés", () => {
    const msg = deployMessage(PLAYER, [
      { name: "render.gno", body: "package gnodice" },
      { name: "gnomod.toml", body: 'module = "gno.land/r/example/gnodice"' }, // remplacé
      { name: "api.gno", body: "package gnodice" },
      { name: "gnodice.gno", body: "package gnodice" },
    ]);
    expect(msg.type).toBe("/vm.m_addpkg");
    if (msg.type !== "/vm.m_addpkg") return;
    expect(msg.value.creator).toBe(PLAYER);
    expect(msg.value.package.name).toBe("gnodice");
    expect(msg.value.package.path).toBe(realmPathFor(PLAYER));
    expect(msg.value.package.files.map((f) => f.name)).toEqual(["api.gno", "gnodice.gno", "gnomod.toml", "render.gno"]);
    const gnomod = msg.value.package.files.find((f) => f.name === "gnomod.toml");
    expect(gnomod?.body).toBe(`module = "gno.land/r/${PLAYER}/gnodice"\ngno = "0.9"\n`);
  });
});

describe("réponses du contrat", () => {
  it("lit le numéro de partie renvoyé par Play", () => {
    expect(parsePlayId('("id=42" string)')).toBe(42);
    expect(parsePlayId("")).toBeNull();
  });

  it("lit le résultat renvoyé par Reveal (format réel de la blockchain)", () => {
    expect(parsePlayResult('("roll=4;won=false;payout=0" string)')).toEqual({ roll: 4, won: false, payout: 0 });
    expect(parsePlayResult('("roll=6;won=true;payout=50000000" string)')).toEqual({ roll: 6, won: true, payout: 50_000_000 });
  });

  it("renvoie null si la réponse est inconnue", () => {
    expect(parsePlayResult("")).toBeNull();
    expect(parsePlayResult("(nil)")).toBeNull();
  });
});
