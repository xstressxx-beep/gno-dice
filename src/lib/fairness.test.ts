import { describe, expect, it } from "vitest";
import { commitment, isHex64, randomHex32, rollFor } from "./fairness";

// Mêmes vecteurs que TestCrossLanguageVectors (contract/gnodice/gnodice_test.gno) :
// le site et le contrat doivent produire exactement les mêmes valeurs.
const ALICE = "g1v9kxjcm9ta047h6lta047h6lta047h6lzd40gh";
const SALT = "2f683125c961cde12579ea12f7ae964c2cfe0d21bb3ca0ab90aeb92528d00575";
const SEED = "f614ae04a1e7a9183914964efe09a9a72bb9229c1ff3ffff4a935faa2c5761e8";

describe("fairness", () => {
  it("calcule la même empreinte que le contrat", async () => {
    expect(await commitment(ALICE, 3, SALT)).toBe("b0ee524a518406c9ca0b10d37962bdd2eb817023959d4896aab9e599afb9e7f2");
  });

  it("calcule le même dé que le contrat", async () => {
    const c = await commitment(ALICE, 3, SALT);
    expect(await rollFor(SEED, c, 42)).toBe(3);
  });

  it("l'empreinte change avec l'adresse, le chiffre et le secret", async () => {
    const base = await commitment(ALICE, 3, SALT);
    expect(await commitment(ALICE, 4, SALT)).not.toBe(base);
    expect(await commitment("g1other", 3, SALT)).not.toBe(base);
    expect(await commitment(ALICE, 3, randomHex32())).not.toBe(base);
  });

  it("génère des secrets de 32 octets, tous différents", () => {
    const a = randomHex32();
    const b = randomHex32();
    expect(isHex64(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("valide le format hexadécimal strict", () => {
    expect(isHex64("a".repeat(64))).toBe(true);
    expect(isHex64("A".repeat(64))).toBe(false);
    expect(isHex64("a".repeat(63))).toBe(false);
    expect(isHex64("")).toBe(false);
  });

  it("répartit le dé uniformément", async () => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[await rollFor(SEED, SALT, i)]++;
    for (let face = 1; face <= 6; face++) {
      expect(counts[face]).toBeGreaterThan(850);
      expect(counts[face]).toBeLessThan(1150);
    }
  });
});
