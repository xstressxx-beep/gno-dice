// Lance les tests du contrat Gno (contract/gnodice) : npm run test:contract
//
// Pré-requis : le dépôt github.com/gnolang/gno cloné et l'outil `gno` installé
// (voir README, section « Tests »). Indique leur emplacement avec :
//   GNO_ROOT  = dossier du dépôt gno cloné   (défaut : ~/tools/gno-src)
//   GNO_BIN   = chemin de l'exécutable gno   (défaut : `gno` dans le PATH)
//
// Le contrat est copié dans <GNO_ROOT>/examples/gno.land/r/example/gnodice :
// ses dépendances (avl, uassert…) y sont trouvées sans téléchargement.

import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.env.GNO_ROOT || join(homedir(), "tools", "gno-src");
const bin = process.env.GNO_BIN || "gno";
const target = join(root, "examples", "gno.land", "r", "example", "gnodice");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const name of readdirSync("contract/gnodice")) cpSync(join("contract/gnodice", name), join(target, name));

const res = spawnSync(bin, ["test", "-root-dir", root, "-v", "./gno.land/r/example/gnodice"], {
  cwd: join(root, "examples"),
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
