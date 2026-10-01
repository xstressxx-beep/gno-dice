import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { FACE_NORMALS, faceBasis, faceUpQuaternion, restHeight, topFace } from "./dicePhysics";

describe("dicePhysics", () => {
  it("les faces opposées font 7", () => {
    for (const face of [1, 2, 3]) {
      const sum = FACE_NORMALS[face].clone().add(FACE_NORMALS[7 - face]);
      expect(sum.length()).toBeCloseTo(0);
    }
  });

  it("au repos (sans rotation), le 1 est en haut", () => {
    expect(topFace(new Quaternion())).toBe(1);
  });

  it("faceUpQuaternion pose chaque face vers le haut", () => {
    for (let face = 1; face <= 6; face++) {
      expect(topFace(faceUpQuaternion(face))).toBe(face);
    }
  });

  it("faceUpQuaternion garde la rotation autour de la verticale", () => {
    const current = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1.1);
    for (let face = 1; face <= 6; face++) {
      expect(topFace(faceUpQuaternion(face, current))).toBe(face);
    }
  });

  it("les axes d'une face sont perpendiculaires à sa normale", () => {
    for (let face = 1; face <= 6; face++) {
      const [u, v] = faceBasis(face);
      expect(u.dot(FACE_NORMALS[face])).toBeCloseTo(0);
      expect(v.dot(FACE_NORMALS[face])).toBeCloseTo(0);
      expect(u.dot(v)).toBeCloseTo(0);
    }
  });

  it("restHeight : 0,5 à plat, plus haut sur une arête", () => {
    expect(restHeight(new Quaternion())).toBeCloseTo(0.5);
    const onEdge = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4);
    expect(restHeight(onEdge)).toBeCloseTo(Math.SQRT2 / 2);
  });
});
