import { describe, expect, it } from "vitest";
import { FACE_ROTATIONS, FACES, landingRotation, nearestAngle, reelIndex, showsFace, spinTo } from "./dice";

describe("nearestAngle", () => {
  it("prend le chemin le plus court", () => {
    expect(nearestAngle(0, 90)).toBe(90);
    expect(nearestAngle(0, -90)).toBe(-90);
    expect(nearestAngle(350, 0)).toBe(360);
    expect(nearestAngle(-710, 0)).toBe(-720);
  });
});

describe("spinTo", () => {
  it("tourne dans le bon sens avec au moins le nombre de tours demandé", () => {
    expect(spinTo(0, 0, 1, 2)).toBe(720);
    expect(spinTo(0, 90, 1, 2)).toBe(810);
    expect(spinTo(0, 0, -1, 2)).toBe(-720);
    // -450 ne suffit pas (moins d'un tour complet depuis -100) : on va jusqu'à -810
    expect(spinTo(-100, -90, -1, 1)).toBe(-810);
  });
});

describe("landingRotation", () => {
  const starts = [
    { x: 0, y: 0 },
    { x: -237.5, y: 412.25 },
    { x: 1080, y: -45 },
    { x: -13, y: 7 },
  ];

  it("montre toujours la bonne face, quel que soit le point de départ", () => {
    for (const start of starts) {
      for (const face of FACES) {
        expect(showsFace(landingRotation(face, start), face)).toBe(true);
        expect(showsFace(landingRotation(face, start, 3), face)).toBe(true);
      }
    }
  });

  it("fait au moins les tours demandés dans le sens du lancer", () => {
    for (const start of starts) {
      for (const face of FACES) {
        const end = landingRotation(face, start, 2);
        expect(start.x - end.x).toBeGreaterThanOrEqual(720);
        expect(end.y - start.y).toBeGreaterThanOrEqual(720);
      }
    }
  });

  it("ne tourne jamais de plus d'un demi-tour sans lancer", () => {
    for (const start of starts) {
      for (const face of FACES) {
        const end = landingRotation(face, start);
        expect(Math.abs(end.x - start.x)).toBeLessThanOrEqual(180);
        expect(Math.abs(end.y - start.y)).toBeLessThanOrEqual(180);
      }
    }
  });

  it("chaque face a une orientation différente", () => {
    const keys = FACES.map((f) => `${FACE_ROTATIONS[f].x}/${FACE_ROTATIONS[f].y}`);
    expect(new Set(keys).size).toBe(6);
  });
});

describe("reelIndex", () => {
  it("place les chiffres de 1 à 6 dans chaque tour", () => {
    expect(reelIndex(1, 0)).toBe(0);
    expect(reelIndex(6, 0)).toBe(5);
    expect(reelIndex(4, 2)).toBe(15);
  });

  it("borne les valeurs hors de 1 à 6", () => {
    expect(reelIndex(9, 0)).toBe(5);
    expect(reelIndex(0, 1)).toBe(6);
  });
});
