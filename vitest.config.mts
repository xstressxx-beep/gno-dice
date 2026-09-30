import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuration des tests du site (npm test).
export default defineConfig({
  resolve: {
    // Même raccourci que dans tsconfig.json : "@/lib/..." = "src/lib/..."
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
