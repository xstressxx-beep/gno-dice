// POST /api/croupier/reveal  { "id": 42, "guess": 3, "salt": "<64 hex>" }
// Relaie la révélation du joueur (une fois le dé tiré) pour terminer la partie
// sans seconde signature. Le contrat vérifie l'empreinte et paie le joueur.

import { revealGame } from "@/lib/server/croupier";
import { gameId, handle, json, readBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(req, "reveal", async () => {
    const body = await readBody(req);
    const id = gameId(body?.id);
    const guess = body?.guess;
    const salt = body?.salt;
    if (!id || typeof guess !== "number" || typeof salt !== "string") return json({ error: "Requête invalide." }, 400);
    const game = await revealGame(id, guess, salt);
    return json({ game });
  });
}
