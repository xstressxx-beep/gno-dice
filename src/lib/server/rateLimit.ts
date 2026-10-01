// Limite simple du nombre d'appels par adresse IP, pour éviter qu'on fasse
// dépenser du gas au croupier en boucle. En mémoire : chaque instance du
// serveur a son propre compteur (suffisant ici, le contrat refuse de toute
// façon les tirages et révélations inutiles).

const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, maxPerMinute = 30): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    return false;
  }
  entry.count++;
  return entry.count > maxPerMinute;
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
