"use client";

// Historique des parties, en deux onglets (Radix UI Tabs) :
// - « Mes parties » : les 10 dernières parties du joueur connecté
// - « Tous les joueurs » : les derniers lancers sur le contrat
// Les données viennent directement du contrat (GetPlayerJSON / GetInfoJSON).
// Les nouvelles lignes glissent en place (Framer Motion) ; les gains sont en rubis.

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDate, formatGnot, shortAddress } from "@/lib/format";
import type { Game, PlayerInfo } from "@/lib/gno";
import { cn } from "@/lib/utils";
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

export function History({ player, recent, contractLive, loading }: Props) {
  const t = useTranslations("history");
  const locale = useLocale();
  const gnot = (n: number) => formatGnot(n, 2, locale);
  const wallet = useWallet();
  const connected = wallet.status === "connected" && !wallet.wrongNetwork;

  let mine: ReactNode;
  if (!contractLive && !player) {
    mine = <Empty>{t("notLive")}</Empty>;
  } else if (!connected) {
    mine = <Empty>{t("connect")}</Empty>;
  } else if (!player) {
    mine = loading ? <SkeletonRows /> : <Empty>{t("unavailable")}</Empty>;
  } else if (player.history.length === 0) {
    mine = <Empty>{t("empty")}</Empty>;
  } else {
    mine = (
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-4">
          <Summary label={t("played")}>
            <AnimatedNumber value={player.played} />
          </Summary>
          <Summary label={t("won")}>
            <AnimatedNumber value={player.wins} />
          </Summary>
          <Summary label={t("wagered")}>
            <AnimatedNumber value={player.wagered} format={gnot} />
          </Summary>
          <Summary label={t("gained")}>
            <AnimatedNumber value={player.paid} format={gnot} />
          </Summary>
        </dl>
        <GameList games={player.history} />
      </div>
    );
  }

  return (
    <section aria-labelledby="history-title" className="flex flex-col">
      <h2 id="history-title" className="display-soft text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-0.02em] text-chalk">
        {t("title")}
      </h2>
      <Tabs defaultValue="mine" className="mt-6">
        <TabsList className="self-start">
          <TabsTrigger value="mine">{t("mine")}</TabsTrigger>
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
        </TabsList>
        <TabsContent value="mine">{mine}</TabsContent>
        <TabsContent value="all">
          {recent.length > 0 ? <GameList games={recent.slice(0, 10)} showPlayer /> : <Empty>{t("noRolls")}</Empty>}
        </TabsContent>
      </Tabs>
    </section>
  );
}

/** Liste de parties : une ligne par lancer, séparées par un filet. */
function GameList({ games, showPlayer = false }: { games: Game[]; showPlayer?: boolean }) {
  const t = useTranslations("history");
  const locale = useLocale();
  return (
    <ol className="flex flex-col border-t border-border">
      <AnimatePresence initial={true}>
        {games.map((game, i) => (
          <motion.li
            key={game.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: Math.min(i, 10) * 0.035 }}
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-3.5 transition-colors hover:bg-white/[0.02]"
          >
            {/* Chiffre joué et résultat */}
            <span className="flex items-center gap-1.5">
              <FaceOrUnknown value={game.guess} variant="ghost" label={t("guess")} />
              <FaceOrUnknown value={game.roll} variant={game.won ? "ruby" : "chalk"} label={t("roll")} />
            </span>

            {/* Mise et date */}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[0.95rem] text-chalk">
                {t("betOn", { amount: formatGnot(game.bet, 2, locale), hasGuess: String(game.guess > 0), guess: game.guess })}
              </span>
              <span className="truncate text-sm text-haze">
                {showPlayer && <span className="text-chalk/70">{shortAddress(game.player)}, </span>}
                {formatDate(game.time, locale)}
              </span>
            </span>

            {/* Résultat */}
            <span className={cn("text-right tabular-nums", game.won ? "display-soft text-xl text-ruby-light" : "text-sm text-haze")}>
              {game.won
                ? `+${formatGnot(game.payout, 2, locale)}`
                : game.status === "refunded"
                  ? t("refunded")
                  : game.status === "expired"
                    ? t("expired")
                    : t("landed", { roll: game.roll })}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

/** Une face de dé, ou « ? » si la valeur est inconnue (jamais dévoilée ou jamais tirée). */
function FaceOrUnknown({ value, variant, label }: { value: number; variant: "ghost" | "ruby" | "chalk"; label: string }) {
  const t = useTranslations("history");
  if (value < 1) {
    return (
      <span role="img" aria-label={t("unknown", { label })} className="grid size-[26px] place-items-center rounded-md border border-dashed border-border text-xs text-haze">
        ?
      </span>
    );
  }
  return <Die value={value} size={26} variant={variant} label={t("face", { label, value })} />;
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-haze">{label}</dt>
      <dd className="display-soft mt-1 text-3xl leading-none text-chalk">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="border-y border-dashed border-border py-8 text-haze">{children}</p>;
}

function SkeletonRows() {
  const t = useTranslations("history");
  return (
    <div className="flex flex-col gap-2" aria-label={t("loading")}>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}
