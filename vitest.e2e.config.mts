import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests de bout en bout sur une chaîne Gno locale (gnodev) : npm run test:e2e
// Le compte « test1 » de gnodev sert de propriétaire et de croupier. Sa phrase secrète
// ci-dessous est PUBLIQUE (publiée dans le code de Gno, uniquement pour les chaînes
// locales de test) : elle ne protège aucun fonds réel. Ne jamais y mettre une vraie clé.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.test.ts"],
    fileParallelism: false,
    env: {
      NEXT_PUBLIC_GNO_RPC_URL: process.env.E2E_RPC_URL || "http://127.0.0.1:26657",
      NEXT_PUBLIC_GNO_CHAIN_ID: "dev",
      NEXT_PUBLIC_GNODICE_REALM: "gno.land/r/example/gnodice",
      CROUPIER_MNEMONIC:
        "source bonus chronic canvas draft south burst lottery vacant surface solve popular case indicate oppose farm nothing bullet exhibit title speed wink action roast",
    },
  },
});
