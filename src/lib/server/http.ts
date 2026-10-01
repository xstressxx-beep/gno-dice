// Outils communs aux routes /api/croupier : lecture sûre du corps JSON,
// réponses d'erreur sans détail interne, limite d'appels.

import { GnoQueryError } from "@/lib/gno";
import { CroupierError } from "./croupier";
import { log } from "./log";
import { clientKey, rateLimited } from "./rateLimit";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Lit un corps JSON de petite taille, ou null s'il est invalide. */
export async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > 2_000) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Numéro de partie valide (entier positif), sinon null. */
export function gameId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Exécute une route avec limite d'appels et gestion des erreurs. */
export async function handle(req: Request, route: string, task: () => Promise<Response>): Promise<Response> {
  if (rateLimited(`${route}:${clientKey(req)}`)) return json({ error: "Trop de requêtes, réessaie dans une minute." }, 429);
  try {
    return await task();
  } catch (e) {
    if (e instanceof CroupierError) return json({ error: e.message }, e.status);
    // Erreurs de lecture de la blockchain : messages déjà rédigés pour l'utilisateur
    if (e instanceof GnoQueryError) return json({ error: e.message }, 502);
    log("error", "api.unexpected", { route, error: e instanceof Error ? e.message.slice(0, 300) : String(e) });
    return json({ error: "Erreur interne du croupier." }, 500);
  }
}
