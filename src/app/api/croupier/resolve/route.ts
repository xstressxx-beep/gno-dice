// POST /api/croupier/resolve  { "id": 42 }
// Demande au croupier de tirer le dé d'une partie en attente. Sans effet si
// la partie est déjà tirée. Réponse : la partie (avec la graine et le dé).

import { after } from "next/server";
import { resolveGame, sweepPendingGames } from "@/lib/server/croupier";
import { gameId, handle, json, readBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Filet de sécurité : au plus un balayage par minute et par instance.
let lastSweep = 0;

export async function POST(req: Request) {
  return handle(req, "resolve", async () => {
    const body = await readBody(req);
    const id = gameId(body?.id);
    if (!id) return json({ error: "Numéro de partie invalide." }, 400);
    const game = await resolveGame(id);
    if (Date.now() - lastSweep > 60_000) {
      lastSweep = Date.now();
      after(() => sweepPendingGames().catch(() => undefined));
    }
    return json({ game });
  });
}
