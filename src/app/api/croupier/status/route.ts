// GET /api/croupier/status
// État du croupier pour le tableau de bord : configuré ?, adresse, solde de
// gas, et s'il est bien celui enregistré dans le contrat. Aucune donnée secrète.

import { croupierStatus } from "@/lib/server/croupier";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req, "status", async () => json(await croupierStatus()));
}
