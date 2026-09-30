import { describe, expect, it } from "vitest";
import { formatCountdown, formatGnot, parseUgnot, shortAddress } from "./format";

describe("format", () => {
  it("convertit les ugnot en GNOT", () => {
    expect(formatGnot(1_000_000)).toBe("1");
    expect(formatGnot(1_500_000)).toBe("1,5");
    expect(formatGnot(50_000_000)).toBe("50");
    expect(formatGnot(22_500, 3)).toBe("0,023");
  });

  it("affiche un compte à rebours mm:ss", () => {
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(593)).toBe("09:53");
    expect(formatCountdown(59.2)).toBe("01:00"); // arrondi au-dessus : on n'affiche jamais 00:00 trop tôt
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
  });

  it("lit un montant en ugnot", () => {
    expect(parseUgnot("999994462600ugnot")).toBe(999994462600);
    expect(parseUgnot("10foo,5ugnot")).toBe(5);
    expect(parseUgnot("")).toBe(0);
  });

  it("raccourcit une adresse", () => {
    expect(shortAddress("g1jgps44vjlq34un3lychj3v3fg6aqapxm0lrhqa")).toBe("g1jgps…rhqa");
  });
});
