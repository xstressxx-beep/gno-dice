import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";
import type { ContractFile } from "@/lib/gnodice";

// Page générée une fois au build : les fichiers du contrat y sont intégrés.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Admin — GNO-DICE",
  robots: { index: false, follow: false },
};

/**
 * Lit le code du contrat (dossier contract/gnodice) pour pouvoir le déployer
 * depuis le navigateur avec Adena. Les fichiers de test ne sont pas envoyés.
 */
function readContractFiles(): ContractFile[] {
  const dir = path.join(process.cwd(), "contract", "gnodice");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".gno") && !name.endsWith("_test.gno"))
    .sort()
    .map((name) => ({
      name,
      // Fins de ligne Unix, quel que soit l'ordinateur qui fait le build.
      body: fs.readFileSync(path.join(dir, name), "utf8").replace(/\r\n/g, "\n"),
    }));
}

export default function AdminPage() {
  return (
    <main className="page-container">
      <AdminPanel files={readContractFiles()} />
    </main>
  );
}
