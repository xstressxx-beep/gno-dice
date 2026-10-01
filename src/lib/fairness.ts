// Équité du jeu, côté site : mêmes calculs que le contrat
// (contract/gnodice/fairness.gno), avec SHA-256 (WebCrypto, navigateur et Node).
//
//   empreinte = sha256("gnodice|v1|commit|" + adresse + "|" + chiffre + "|" + secret)
//   dé        = 1 + (8 premiers octets de sha256("gnodice|v1|roll|" + graine + "|" + empreinte + "|" + numéro)) mod 6
//
// Le secret (32 octets aléatoires) cache le chiffre du joueur pendant que le
// croupier tire le dé. Le site recalcule le dé avec la graine publiée par le
// croupier : si le résultat ne correspond pas, il le signale.

const HEX64 = /^[0-9a-f]{64}$/;

export function isHex64(value: string): boolean {
  return HEX64.test(value);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return new Uint8Array(digest);
}

/** 32 octets aléatoires (générateur cryptographique), en hexadécimal. */
export function randomHex32(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Empreinte du chiffre caché, identique à Commitment() dans le contrat. */
export async function commitment(player: string, guess: number, salt: string): Promise<string> {
  return toHex(await sha256(`gnodice|v1|commit|${player}|${guess}|${salt}`));
}

/** Dé calculé à partir de la graine du croupier, identique à rollFromSeed() dans le contrat. */
export async function rollFor(seed: string, commit: string, id: number): Promise<number> {
  const digest = await sha256(`gnodice|v1|roll|${seed}|${commit}|${id}`);
  // 8 premiers octets lus comme un entier non signé de 64 bits (gros-boutiste)
  const n = new DataView(digest.buffer, digest.byteOffset, 8).getBigUint64(0, false);
  return Number(n % BigInt(6)) + 1;
}
