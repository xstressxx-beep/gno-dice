"use client";

// Historique des parties, en deux onglets (Radix UI Tabs) :
// - « Mes parties » : les 10 dernières parties du joueur connecté
// - « Tous les joueurs » : les derniers lancers sur le contrat
// Les données viennent directement du contrat (GetPlayerJSON / GetInfoJSON).
// Chaque ligne apparaît en glissant (Framer Motion) ; les victoires brillent en or.

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, History as HistoryIcon, Trophy, Users } from "lucide-react";
import { formatDate, formatGnot, shortAddress } from "@/lib/format";
import type { Game, PlayerInfo } from "@/lib/gno";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedNumber } from "./AnimatedNumber";
import { Die } from "./Die";
import { useWallet } from "./WalletProvider";

type Props = {
  player: PlayerInfo | null;
  /** Derniers lancers de tous les joueurs */
  recent: Game[];
  /** true quand le contrat est actif sur la blockchain */
  contractLive: boolean;
  loading: boolean;
};

const gnot = (n: number) => formatGnot(n);

export function History({ player, recent, contractLive, loading }: Props) {
  const wallet = useWallet();
  const connected = wallet.status === "connected" && !wallet.wrongNetwork;

  let mine: ReactNode;
  if (!contractLive && !player) {
    mine = <Empty>L’historique s’affichera dès que le contrat sera actif.</Empty>;
  } else if (!connected) {
    mine = <Empty>Connecte ton wallet Adena pour voir tes 10 dernières parties.</Empty>;
  } else if (!player) {
    mine = loading ? <SkeletonRows /> : <Empty>Historique indisponible pour le moment.</Empty>;
  } else if (player.history.length === 0) {
    mine = <Empty>Aucune partie pour l’instant. Lance le dé pour commencer !</Empty>;
  } else {
    mine = (
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <Summary label="Parties">
            <AnimatedNumber value={player.played} />
          </Summary>
          <Summary label="Gagnées">
            <AnimatedNumber value={player.wins} />
          </Summary>
          <Summary label="Total misé">
            <AnimatedNumber value={player.wagered} format={gnot} /> <small className="text-xs text-muted-foreground">GNOT</small>
          </Summary>
          <Summary label="Total gagné">
            <AnimatedNumber value={player.paid} format={gnot} className="gold-text" /> <small className="text-xs text-primary">GNOT</small>
          </Summary>
        </dl>
        <GameList games={player.history} />
      </div>
    );
  }

  return (
    <Card aria-labelledby="history-title">
      <CardHeader>
        <CardTitle id="history-title" className="flex items-center gap-2">
          <HistoryIcon className="size-4" /> Historique des parties
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="mine">
          <TabsList className="w-full sm:w-auto sm:self-start">
            <TabsTrigger value="mine">
              <Trophy /> Mes 10 dernières
            </TabsTrigger>
            <TabsTrigger value="all">
              <Users /> Tous les joueurs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mine">{mine}</TabsContent>
          <TabsContent value="all">
            {recent.length > 0 ? <GameList games={recent.slice(0, 10)} showPlayer /> : <Empty>Aucun lancer pour l’instant.</Empty>}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/** Liste de parties : les nouvelles lignes glissent en place, les autres descendent. */
function GameList({ games, showPlayer = false }: { games: Game[]; showPlayer?: boolean }) {
  return (
    <ol className="flex flex-col gap-2">
      <AnimatePresence initial={true}>
        {games.map((game, i) => (
          <motion.li
            key={game.id}
            layout
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.35, delay: Math.min(i, 10) * 0.04 }}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2.5 sm:gap-4 sm:px-4",
              game.won
                ? "border-primary/45 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent shadow-[0_0_20px_rgba(245,197,66,0.12)]"
                : "border-white/5 bg-black/35",
            )}
          >
            {/* Chiffre joué → résultat du dé */}
            <span className="flex items-center gap-1.5">
              <Die value={game.guess} size={28} variant="gold" label={`Chiffre joué : ${game.guess}`} />
              <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
              <Die value={game.roll} size={28} variant={game.won ? "gold" : "ivory"} label={`Résultat du dé : ${game.roll}`} />
            </span>

            {/* Mise et date */}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">
                Mise {formatGnot(game.bet)} GNOT <span className="font-normal text-muted-foreground">sur le {game.guess}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {showPlayer && <span className="font-mono text-foreground/75">{shortAddress(game.player)} · </span>}
                {formatDate(game.time)}
              </span>
            </span>

            {/* Résultat */}
            {game.won ? (
              <Badge variant="default">+{formatGnot(game.payout)} GNOT</Badge>
            ) : (
              <Badge variant="lose">Perdu</Badge>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-primary/10 bg-black/35 px-3 py-2">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-extrabold tabular-nums">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-primary/15 px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2" aria-label="Chargement de l’historique">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}
