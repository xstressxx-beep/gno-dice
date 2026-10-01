import { describe, expect, it, vi } from "vitest";

vi.mock("./croupier", () => ({ CroupierError: class extends Error {} }));
vi.mock("@/lib/gno", () => ({ GnoQueryError: class extends Error {} }));
vi.mock("./log", () => ({ log: vi.fn() }));

import { gameId, readBody } from "./http";
import { rateLimited } from "./rateLimit";

describe("validation des requêtes du croupier", () => {
  it("n'accepte que des numéros de partie entiers positifs", () => {
    expect(gameId(42)).toBe(42);
    for (const bad of [0, -1, 1.5, "42", null, undefined, Number.MAX_SAFE_INTEGER + 2, NaN]) expect(gameId(bad)).toBeNull();
  });

  it("refuse les corps JSON invalides ou trop gros", async () => {
    const req = (body: string) => new Request("http://x", { method: "POST", body });
    expect(await readBody(req('{"id":1}'))).toEqual({ id: 1 });
    expect(await readBody(req("pas du json"))).toBeNull();
    expect(await readBody(req("[1,2]"))).toBeNull();
    expect(await readBody(req(JSON.stringify({ x: "a".repeat(3000) })))).toBeNull();
  });

  it("limite le nombre d'appels par minute", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 30; i++) expect(rateLimited(key, 30)).toBe(false);
    expect(rateLimited(key, 30)).toBe(true);
  });
});
