// Configuration du site : réseau Gno et adresse du contrat.
// Les valeurs viennent des variables d'environnement NEXT_PUBLIC_* (voir
// .env.example). Next.js les intègre au site au moment du build : après une
// modification sur Vercel, il faut redéployer.

// Adresse du wallet Adena du propriétaire (celle qui a déjà publié la roulette
// Gnosino : gno.land/r/g1u97n.../roulette_v6). En déployant le contrat depuis
// /admin avec ce wallet, il arrive exactement au chemin ci-dessous : le site
// fonctionne alors sans aucun réglage sur Vercel.
const OWNER_ADDRESS = "g1u97n45s4s6q7vn5clr8339pv4up455hnqn4aff";
const DEFAULT_REALM = `gno.land/r/${OWNER_ADDRESS}/gnodice`;

export const config = {
  chainId: process.env.NEXT_PUBLIC_GNO_CHAIN_ID || "onyx-1",
  chainName: process.env.NEXT_PUBLIC_GNO_CHAIN_NAME || "Gno.land Onyx (testnet)",
  rpcUrl: process.env.NEXT_PUBLIC_GNO_RPC_URL || "https://rpc.onyx.testnets.gno.land:443",
  gnowebUrl: process.env.NEXT_PUBLIC_GNOWEB_URL || "https://onyx.testnets.gno.land",
  faucetUrl: process.env.NEXT_PUBLIC_FAUCET_URL ?? "https://faucet.gno.land",
  // Chemin du contrat : la variable NEXT_PUBLIC_GNODICE_REALM est prioritaire
  // (utile si le contrat est déployé avec un autre wallet).
  realmPath: (process.env.NEXT_PUBLIC_GNODICE_REALM || DEFAULT_REALM).trim(),
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

// Dépôt de stockage prévu pour la toute première partie d'un joueur (mesuré :
// ~0,44 GNOT, le contrat crée sa fiche et son historique), puis une petite
// marge pour les parties suivantes. Sert à vérifier le solde avant de jouer.
export const FIRST_GAME_DEPOSIT_UGNOT = 500_000;
export const NEXT_GAME_DEPOSIT_UGNOT = 100_000;

// Nom affiché dans Adena lors de la demande de connexion.
export const SITE_NAME = "GNO-DICE";
