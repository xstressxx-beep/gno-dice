import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empêche `next dev` d'ajouter automatiquement un bloc de texte à la fin
  // de notre CLAUDE.md (comportement par défaut de Next.js 16 quand il
  // détecte un assistant IA).
  agentRules: false,
};

export default nextConfig;
