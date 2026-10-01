// GET /api/croupier/sweep
// Tire toutes les parties en attente. Appelé par la tâche planifiée de Vercel
// (vercel.json), protégé par le jeton CRON_SECRET que Vercel envoie dans
// l'en-tête Authorization.

import { timingSafeEqual } from "node:crypto";
import { sweepPendingGames } from "@/lib/server/croupier";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  return handle(req, "sweep", async () => {
    if (!authorized(req)) return json({ error: "Non autorisé." }, 401);
    return json(await sweepPendingGames());
  });
}
