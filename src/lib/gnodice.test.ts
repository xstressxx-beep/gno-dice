import { describe, expect, it } from "vitest";
import { deployMessage, fundMessage, parsePlayResult, playMessage, realmPathFor } from "./gnodice";

const PLAYER = "g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrhqa";
const REALM = "gno.land/r/g1vu4h2u5s99g7pz8exlv3dsd2ks3ness2ssq7hl/gnodice";

describe("messages de transaction", () => {
  it("prépare un lancer de dé", () => {
    expect(playMessage(PLAYER, 6, 10_000_000, REALM)).toEqual({
      type: "/vm.m_call",
      value: { caller: PLAYER, send: "10000000ugnot", max_deposit: "", pkg_path: REALM, func: "Play", args: ["6"] },
    });
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

describe("résultat d'un lancer", () => {
  it("lit la valeur renvoyée par Play (format réel de la blockchain)", () => {
    expect(parsePlayResult('("roll=4;won=false;payout=0" string)')).toEqual({ roll: 4, won: false, payout: 0 });
    expect(parsePlayResult('("roll=6;won=true;payout=50000000" string)')).toEqual({ roll: 6, won: true, payout: 50_000_000 });
  });

  it("renvoie null si la réponse est inconnue", () => {
    expect(parsePlayResult("")).toBeNull();
    expect(parsePlayResult("(nil)")).toBeNull();
  });
});
