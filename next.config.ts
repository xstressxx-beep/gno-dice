import type { NextConfig } from "next";

// Nœud RPC Gno : la seule adresse externe que la page a le droit d'appeler.
const rpcUrl = process.env.NEXT_PUBLIC_GNO_RPC_URL || "https://rpc.onyx.testnets.gno.land:443";
const rpcOrigin = new URL(rpcUrl).origin;
const isDev = process.env.NODE_ENV !== "production";

// Politique de sécurité du contenu (CSP) : limite ce qu'un script injecté
// pourrait faire. Next.js et notre petit script de démarrage (layout.tsx)
// sont en ligne, d'où 'unsafe-inline' pour les scripts ; en développement,
// le rechargement à chaud a aussi besoin de 'unsafe-eval' et des websockets.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${rpcOrigin}${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Empêche `next dev` d'ajouter automatiquement un bloc de texte à la fin
  // de notre CLAUDE.md (comportement par défaut de Next.js 16 quand il
  // détecte un assistant IA).
  agentRules: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Interdit d'afficher le site dans un cadre : empêche le « clickjacking »
          // (une page piège qui ferait cliquer sur « Lancer » à l'insu du joueur).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
