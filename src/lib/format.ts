// Petites fonctions d'affichage.

export const UGNOT_PER_GNOT = 1_000_000;

/** Convertit des ugnot en GNOT lisibles : 1500000 -> "1,5". */
export function formatGnot(ugnot: number, maxDecimals = 2): string {
  return (ugnot / UGNOT_PER_GNOT).toLocaleString("fr-FR", {
    maximumFractionDigits: maxDecimals,
  });
}

/** Raccourcit une adresse : g1abcd…wxyz */
export function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Transforme des secondes en "mm:ss". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Date lisible à partir d'un horodatage Unix (secondes). */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Extrait le montant en ugnot d'une chaîne comme "12345ugnot,10foo". */
export function parseUgnot(coins: string): number {
  const match = /(\d+)ugnot/.exec(coins);
  return match ? Number(match[1]) : 0;
}
