// Calculs du dé 3D (Three.js, sans React) : orientation des faces, face du
// dessus, rotation qui pose une face donnée vers le haut, hauteur de repos.
// Testé dans dicePhysics.test.ts.

import { Euler, Matrix4, Quaternion, Vector3 } from "three";

// Normale (vers l'extérieur) de chaque face dans le repère du dé.
// Les faces opposées font toujours 7, comme sur un vrai dé : 1-6, 2-5, 3-4.
export const FACE_NORMALS: Record<number, Vector3> = {
  1: new Vector3(0, 1, 0),
  6: new Vector3(0, -1, 0),
  2: new Vector3(0, 0, 1),
  5: new Vector3(0, 0, -1),
  3: new Vector3(1, 0, 0),
  4: new Vector3(-1, 0, 0),
};

export const UP = new Vector3(0, 1, 0);

/** Les deux axes « dans le plan » d'une face, pour y placer les points. */
export function faceBasis(face: number): [Vector3, Vector3] {
  const n = FACE_NORMALS[face];
  if (Math.abs(n.y) === 1) return [new Vector3(1, 0, 0), new Vector3(0, 0, n.y)];
  if (Math.abs(n.z) === 1) return [new Vector3(n.z, 0, 0), new Vector3(0, -1, 0)];
  return [new Vector3(0, 0, -n.x), new Vector3(0, -1, 0)];
}

/** La face qui regarde le plus vers le haut pour une orientation donnée. */
export function topFace(q: Quaternion): number {
  let best = 1;
  let bestDot = -Infinity;
  const v = new Vector3();
  for (const [face, n] of Object.entries(FACE_NORMALS)) {
    const d = v.copy(n).applyQuaternion(q).dot(UP);
    if (d > bestDot) {
      bestDot = d;
      best = Number(face);
    }
  }
  return best;
}

/**
 * Orientation qui pose `face` vers le haut, en gardant (autant que possible)
 * la rotation actuelle autour de l'axe vertical : le dé « tombe » sur la bonne
 * face au lieu de pivoter brusquement sur lui-même.
 */
export function faceUpQuaternion(face: number, current?: Quaternion): Quaternion {
  const n = FACE_NORMALS[face] ?? FACE_NORMALS[1];
  const base = new Quaternion().setFromUnitVectors(n, UP);
  if (!current) return base;
  // Lacet (rotation autour de Y) de l'orientation actuelle
  const yaw = new Euler().setFromQuaternion(current, "YXZ").y;
  const baseYaw = new Euler().setFromQuaternion(base, "YXZ").y;
  return new Quaternion().setFromAxisAngle(UP, yaw - baseYaw).multiply(base);
}

/** Hauteur du centre au-dessus du sol pour qu'un cube de côté `size` le touche. */
export function restHeight(q: Quaternion, size = 1): number {
  // Colonnes de la matrice = les trois axes du dé dans le monde ;
  // leur composante verticale est le 2e élément de chaque colonne.
  const e = new Matrix4().makeRotationFromQuaternion(q).elements;
  // Demi-hauteur = somme des projections des trois demi-axes sur la verticale
  return (size / 2) * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9]));
}
