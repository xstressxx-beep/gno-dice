// Prépare le contrat pour un déploiement avec gnokey.
//
// Le gnomod.toml du dépôt garde le chemin de test (gno.land/r/example/gnodice).
// Ce script copie le contrat dans .deploy/gnodice, SANS les fichiers de test,
// et y écrit le vrai chemin : gno.land/r/<adresse>/gnodice.
//
// Utilisation : node scripts/prepare-deploy.mjs [adresse-g1]
// (par défaut : l'adresse du propriétaire de src/lib/config.ts)

import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const config = readFileSync("src/lib/config.ts", "utf8");
const owner = process.argv[2] || config.match(/OWNER_ADDRESS = "(g1[a-z0-9]+)"/)?.[1];
if (!owner || !/^g1[02-9ac-hj-np-z]{38}$/.test(owner)) {
  console.error("Adresse g1 invalide :", owner);
  process.exit(1);
}

const src = join("contract", "gnodice");
const out = join(".deploy", "gnodice");
rmSync(".deploy", { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const file of readdirSync(src)) {
  // Les tests ne servent pas on-chain : on économise du gas et du stockage
  if (!file.endsWith(".gno") || file.endsWith("_test.gno")) continue;
  copyFileSync(join(src, file), join(out, file));
}

const pkgPath = `gno.land/r/${owner}/gnodice`;
writeFileSync(join(out, "gnomod.toml"), `module = "${pkgPath}"\ngno = "0.9"\n`);

console.log(`Contrat prêt dans ${out}`);
console.log(`Chemin : ${pkgPath}`);
