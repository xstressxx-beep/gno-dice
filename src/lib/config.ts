// Configuration du site : réseau Gno et adresse du contrat.
// Les valeurs viennent des variables d'environnement NEXT_PUBLIC_* (voir
// .env.example). Next.js les intègre au site au moment du build : après une
// modification sur Vercel, il faut redéployer.

export const config = {
  chainId: process.env.NEXT_PUBLIC_GNO_CHAIN_ID || "onyx-1",
  chainName: process.env.NEXT_PUBLIC_GNO_CHAIN_NAME || "Gno.land Onyx (testnet)",
  rpcUrl: process.env.NEXT_PUBLIC_GNO_RPC_URL || "https://rpc.onyx.testnets.gno.land:443",
  gnowebUrl: process.env.NEXT_PUBLIC_GNOWEB_URL || "https://onyx.testnets.gno.land",
  faucetUrl: process.env.NEXT_PUBLIC_FAUCET_URL ?? "https://faucet.gno.land",
  realmPath: (process.env.NEXT_PUBLIC_GNODICE_REALM || "").trim(),
};

// Règles du jeu, identiques à celles du contrat (contract/gnodice/gnodice.gno).
// Le site lit les vraies valeurs dans le contrat quand il est disponible.
export const GAME = {
  minBetGnot: 1,
  maxBetGnot: 10,
  multiplier: 5,
  cooldownSeconds: 600,
  faces: [1, 2, 3, 4, 5, 6] as const,
};

// Gas demandé pour chaque type de transaction. Mesuré sur une chaîne locale :
// Play ≈ 6,4 M, Fund ≈ 3,2 M, déploiement ≈ 33 M. Les frais payés sont
// calculés à partir de ces limites (gas demandé × prix du gas du réseau),
// on garde donc une marge raisonnable sans exagérer.
export const GAS = {
  play: 15_000_000,
  admin: 10_000_000,
  deploy: 80_000_000,
};

// Nom affiché dans Adena lors de la demande de connexion.
export const SITE_NAME = "GNO-DICE";
