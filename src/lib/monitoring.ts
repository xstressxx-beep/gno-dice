// Surveillance du jeu : calcule les alertes affichées dans /admin à partir de
// l'état du contrat, de l'état du croupier et des parties en cours.
// Fonction pure (sans réseau) : testée dans monitoring.test.ts.

import type { Game, GameInfo } from "./gno";

export type AlertLevel = "critical" | "warning" | "info";
export type MonitorAlert = { level: AlertLevel; title: string; detail: string };

export type CroupierState =
  | { configured: false }
  | { configured: true; address: string; balance: number; activeOnContract: boolean | null }
  | null; // pas encore lu

const UGNOT = 1_000_000;
// En dessous, le croupier risque de ne plus pouvoir payer le gas de ses tirages.
export const CROUPIER_MIN_GAS_UGNOT = 1 * UGNOT;
// Une partie tirée mais pas dévoilée depuis plus d'un jour mérite un coup d'œil.
const STALE_ROLLED_S = 24 * 3600;
// Écart (en écarts-types) au-delà duquel le taux de victoire est jugé anormal.
const Z_THRESHOLD = 4;
const MIN_GAMES_FOR_STATS = 60;

export type Stats = {
  settled: number;
  winRate: number | null; // victoires / parties jouées jusqu'au bout
  rtp: number | null; // gains payés / mises des parties terminées (théorique : 5/6)
  zScore: number | null;
};

export function computeStats(info: GameInfo): Stats {
  const settled = info.totalWins + info.totalLosses;
  if (settled === 0) return { settled, winRate: null, rtp: null, zScore: null };
  const p = 1 / 6;
  const winRate = info.totalWins / settled;
  const zScore = (winRate - p) / Math.sqrt((p * (1 - p)) / settled);
  // totalWagered comprend les mises des parties en cours : approximation suffisante
  const rtp = info.totalWagered > 0 ? info.totalPaid / info.totalWagered : null;
  return { settled, winRate, rtp, zScore };
}

export function computeAlerts(info: GameInfo, croupier: CroupierState, open: Game[], nowSec: number): MonitorAlert[] {
  const alerts: MonitorAlert[] = [];
  const gnot = (u: number) => (u / UGNOT).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  // --- Jeu arrêté ---
  if (info.paused) {
    const tripped = info.payoutToday >= info.dailyPayoutLimit;
    alerts.push({
      level: "critical",
      title: tripped ? "Coupe-circuit déclenché" : "Jeu en pause",
      detail: tripped
        ? `Les gains du jour (${gnot(info.payoutToday)} GNOT) ont atteint la limite de ${gnot(info.dailyPayoutLimit)} GNOT. Vérifie les dernières parties avant de relancer.`
        : "Les nouvelles mises sont refusées. Les parties en cours peuvent se terminer.",
    });
  }

  // --- Croupier ---
  if (croupier && !croupier.configured) {
    alerts.push({
      level: "critical",
      title: "Croupier non configuré",
      detail: "Ajoute CROUPIER_MNEMONIC dans les variables d'environnement Vercel : sans croupier, aucun dé n'est tiré et les mises sont remboursées après 30 minutes.",
    });
  } else if (croupier && croupier.configured) {
    if (croupier.activeOnContract === false) {
      alerts.push({
        level: "critical",
        title: "Le contrat attend un autre croupier",
        detail: `Le contrat autorise ${info.croupier}, mais le serveur signe avec ${croupier.address}. Clique sur « Utiliser ce croupier ».`,
      });
    }
    if (croupier.balance >= 0 && croupier.balance < CROUPIER_MIN_GAS_UGNOT) {
      alerts.push({
        level: "warning",
        title: "Croupier presque à court de gas",
        detail: `Il reste ${gnot(croupier.balance)} GNOT sur ${croupier.address}. Envoie-lui quelques GNOT.`,
      });
    }
  }

  // --- Banque ---
  if (info.available < info.lowBankroll) {
    alerts.push({
      level: "warning",
      title: "Banque basse",
      detail: `Solde disponible : ${gnot(info.available)} GNOT (seuil d'alerte : ${gnot(info.lowBankroll)} GNOT).`,
    });
  }
  if (!info.paused && info.maxCoverableBet < info.maxBet) {
    alerts.push({
      level: "warning",
      title: "La mise maximale n'est plus acceptée",
      detail: `La banque ne couvre qu'une mise de ${gnot(info.maxCoverableBet)} GNOT. Alimente-la pour revenir à ${gnot(info.maxBet)} GNOT.`,
    });
  }
  if (!info.paused && info.payoutToday >= info.dailyPayoutLimit * 0.8 && info.payoutToday < info.dailyPayoutLimit) {
    alerts.push({
      level: "warning",
      title: "Coupe-circuit bientôt atteint",
      detail: `${gnot(info.payoutToday)} GNOT payés aujourd'hui sur ${gnot(info.dailyPayoutLimit)} GNOT autorisés.`,
    });
  }

  // --- Parties bloquées ---
  const refundable = open.filter((g) => g.status === "pending" && nowSec >= g.resolveDeadline);
  if (refundable.length > 0) {
    alerts.push({
      level: "warning",
      title: `${refundable.length} partie(s) non tirée(s) à temps`,
      detail: `Le croupier n'a pas répondu (n° ${refundable.map((g) => g.id).join(", ")}). Ces joueurs peuvent récupérer leur mise.`,
    });
  }
  const stale = open.filter((g) => g.status === "rolled" && nowSec - g.rolledAt > STALE_ROLLED_S);
  if (stale.length > 0) {
    alerts.push({
      level: "info",
      title: `${stale.length} partie(s) jamais dévoilée(s)`,
      detail: "Elles expireront 7 jours après le tirage et compteront comme perdues ; leur réserve est bloquée d'ici là.",
    });
  }

  // --- Comportements suspects ---
  const stats = computeStats(info);
  if (stats.zScore !== null && stats.settled >= MIN_GAMES_FOR_STATS && stats.zScore > Z_THRESHOLD) {
    alerts.push({
      level: "critical",
      title: "Taux de victoire anormalement élevé",
      detail: `${(stats.winRate! * 100).toFixed(1)} % de victoires sur ${stats.settled} parties (attendu : 16,7 %). Possible croupier compromis : mets le jeu en pause et change de croupier.`,
    });
  }
  const recentWins = new Map<string, number>();
  for (const g of info.recent) if (g.won) recentWins.set(g.player, (recentWins.get(g.player) ?? 0) + 1);
  for (const [player, wins] of recentWins) {
    if (wins >= 3) {
      alerts.push({
        level: "info",
        title: "Joueur à surveiller",
        detail: `${player} a gagné ${wins} des ${info.recent.length} dernières parties. Possible chance, mais à vérifier (historique du joueur sur gnoweb).`,
      });
    }
  }

  return alerts;
}
