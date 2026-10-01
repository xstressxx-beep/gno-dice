// Configuration du site : réseau Gno et adresse du contrat.
// Les valeurs viennent des variables d'environnement NEXT_PUBLIC_* (voir
// .env.example). Next.js les intègre au site au moment du build : après une
// modification sur Vercel, il faut redéployer.

// Adresse du wallet Adena du propriétaire. Le même wallet possède aussi la
// roulette Gnosino (projet séparé, chemin roulette_v6) : les deux contrats ont
// des chemins différents, donc aucun conflit. En déployant le contrat depuis
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

// Gas demandé pour chaque type de transaction, MESURÉ sur une vraie chaîne
// locale (gnodev, test de bout en bout du 01/10/2026) puis +50 % de marge :
// Play ≈ 16,5 M, Resolve ≈ 7,3 M, Reveal gagnant ≈ 14,8 M / perdant ≈ 13,6 M.
// Les frais payés = gas demandé × prix du gas du réseau (voir estimateFee).
export const GAS = {
  play: 25_000_000,
  resolve: 12_000_000,
  reveal: 22_000_000,
  refund: 22_000_000,
  admin: 15_000_000,
  deploy: 120_000_000, // contrat en 7 fichiers depuis l'audit de sécurité
};

// Dépôt de stockage bloqué par la chaîne lors d'une mise (mesuré : ~0,84 GNOT
// pour la 1re partie d'un joueur, qui crée sa fiche ; moins ensuite). Sert à
// vérifier le solde avant de jouer, avec un peu de marge.
export const FIRST_GAME_DEPOSIT_UGNOT = 1_000_000;
export const NEXT_GAME_DEPOSIT_UGNOT = 500_000;

// Nom affiché dans Adena lors de la demande de connexion.
export const SITE_NAME = "GNO-DICE";
