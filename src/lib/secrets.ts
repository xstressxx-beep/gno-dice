// Secrets des parties en cours, gardés dans le navigateur du joueur.
//
// Pour cacher son chiffre au croupier, le joueur garde chez lui le chiffre et
// un secret aléatoire jusqu'au tirage. Sans eux, impossible de prouver une
// victoire : on les enregistre donc AVANT d'envoyer la mise, et on les efface
// une fois la partie terminée. Ils ne quittent le navigateur qu'après le tirage.

export type Secret = {
  player: string;
  commitment: string;
  guess: number;
  salt: string;
  /** Numéro de la partie, connu après la transaction. */
  id?: number;
  /** Date d'enregistrement (millisecondes), ajoutée automatiquement. */
  createdAt?: number;
};

const PREFIX = "gd-secret:";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // stockage bloqué (navigation privée stricte…)
  }
}

export function saveSecret(secret: Secret): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(PREFIX + secret.commitment, JSON.stringify({ ...secret, createdAt: secret.createdAt ?? Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function findSecret(commitment: string): Secret | null {
  const raw = storage()?.getItem(PREFIX + commitment);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Secret;
    return parsed.commitment === commitment ? parsed : null;
  } catch {
    return null;
  }
}

export function setSecretId(commitment: string, id: number) {
  const secret = findSecret(commitment);
  if (secret) saveSecret({ ...secret, id });
}

export function forgetSecret(commitment: string) {
  try {
    storage()?.removeItem(PREFIX + commitment);
  } catch {
    // rien à faire
  }
}
