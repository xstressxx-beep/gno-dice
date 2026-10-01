// Appels du navigateur vers le croupier du site (routes /api/croupier/*).
// Délai maximal et nouvel essai automatique sur les pannes passagères ;
// ces appels sont sans danger à répéter (le croupier relit l'état d'abord).

import type { Game } from "./gno";

const TIMEOUT_MS = 45_000; // une transaction attend la confirmation d'un bloc
const RETRY_DELAYS_MS = [1_500, 4_000];

export class CroupierUnavailable extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(path: string, body: unknown): Promise<Game> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      res = null; // réseau ou délai dépassé
    }
    if (res?.ok) return ((await res.json()) as { game: Game }).game;
    const retryable = !res || res.status >= 500 || res.status === 429;
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
      const message = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : undefined;
      throw new CroupierUnavailable(message || "Le croupier ne répond pas.");
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

/** Demande le tirage du dé d'une partie. */
export function requestResolve(id: number): Promise<Game> {
  return post("/api/croupier/resolve", { id });
}

/** Demande au croupier de relayer la révélation (le joueur n'a pas à signer une 2e fois). */
export function requestReveal(id: number, guess: number, salt: string): Promise<Game> {
  return post("/api/croupier/reveal", { id, guess, salt });
}
