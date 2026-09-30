// Calculs du dé 3D (sans React) : quelle rotation montre quelle face,
// et la position des chiffres sur la bande qui défile. Testé dans dice.test.ts.

export type Rotation = { x: number; y: number };

export const FACES = [1, 2, 3, 4, 5, 6] as const;

/**
 * Où est collée chaque face sur le cube (avant de la pousser vers l'extérieur).
 * Les faces opposées font toujours 7 : 1-6, 2-5, 3-4, comme un vrai dé.
 */
export const FACE_TRANSFORMS: Record<number, string> = {
  1: "rotateY(0deg)",
  6: "rotateY(180deg)",
  3: "rotateY(90deg)",
  4: "rotateY(-90deg)",
  2: "rotateX(90deg)",
  5: "rotateX(-90deg)",
};

/** Rotation du cube (en degrés) qui amène chaque face face à nous. */
export const FACE_ROTATIONS: Record<number, Rotation> = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  2: { x: -90, y: 0 },
  5: { x: 90, y: 0 },
};

/** Reste de la division toujours positif : mod(-90, 360) = 270. */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** L'angle équivalent à `base` (à un tour près) le plus proche de `current`. */
export function nearestAngle(current: number, base: number): number {
  let delta = mod(base - current, 360);
  if (delta > 180) delta -= 360;
  return current + delta;
}

/**
 * L'angle équivalent à `base` atteint en tournant dans le sens `direction`
 * (+1 ou -1) après au moins `minTurns` tours complets.
 */
export function spinTo(current: number, base: number, direction: 1 | -1, minTurns: number): number {
  const start = current + direction * minTurns * 360;
  const delta = direction === 1 ? mod(base - start, 360) : -mod(start - base, 360);
  return start + delta;
}

/**
 * Rotation finale du cube pour montrer `face`.
 * - spins = 0 : chemin le plus court (quand on change de chiffre)
 * - spins > 0 : le dé continue de rouler dans le même sens et fait
 *   quelques tours de plus avant de se poser (fin d'un lancer)
 */
export function landingRotation(face: number, current: Rotation, spins = 0): Rotation {
  const base = FACE_ROTATIONS[face] ?? FACE_ROTATIONS[1];
  if (spins <= 0) return { x: nearestAngle(current.x, base.x), y: nearestAngle(current.y, base.y) };
  // Pendant le lancer, x diminue et y augmente : on garde ces sens.
  return { x: spinTo(current.x, base.x, -1, spins), y: spinTo(current.y, base.y, 1, spins) };
}

/** Vrai si la rotation montre bien `face` (à un nombre de tours près). */
export function showsFace(rotation: Rotation, face: number): boolean {
  const base = FACE_ROTATIONS[face];
  return !!base && mod(rotation.x - base.x, 360) === 0 && mod(rotation.y - base.y, 360) === 0;
}

// --- Bande de chiffres qui défile (compteur façon machine à sous) ---

/** La bande répète 1 à 6 plusieurs fois pour pouvoir défiler longtemps. */
export const REEL_CYCLES = 5;

/** Position (en cases depuis le haut) du chiffre `value` dans le tour `cycle` de la bande. */
export function reelIndex(value: number, cycle: number): number {
  const v = Math.min(6, Math.max(1, Math.round(value)));
  return cycle * FACES.length + (v - 1);
}
