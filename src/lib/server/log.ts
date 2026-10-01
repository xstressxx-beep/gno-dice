// Journaux structurés (une ligne JSON par événement) : faciles à filtrer dans
// les logs Vercel, par ex. `"event":"croupier.tx_failed"`.
// Ne jamais y écrire de secret (phrase du wallet, secret d'un joueur).

type Level = "info" | "warn" | "error";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
