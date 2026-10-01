"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PauseCircle } from "lucide-react";
import { contractUrl, GAME } from "@/lib/config";
import { formatGnot } from "@/lib/format";
import type { GameInfo } from "@/lib/gno";
import type { ContractStatus } from "@/hooks/useGnodice";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "./AnimatedNumber";

type Props = {
  info: GameInfo | null;
  status: ContractStatus;
};


/** La banque du casino : ce qu'elle peut payer et ce qu'elle a déjà payé. */
export function BankPanel({ info, status }: Props) {
  const t = useTranslations("bank");
  const locale = useLocale();
  const gnot = (n: number) => formatGnot(n, 2, locale);
  // Texte affiché quand la banque n'est pas lisible
  const STATUS_TEXT: Record<ContractStatus, string> = {
    loading: "",
    live: "",
    absent: t("absent"),
    inert: t("inert"),
    unreachable: t("unreachable"),
  };
  return (
    <section aria-labelledby="bank-title" className="flex flex-col">
      <h2 id="bank-title" className="display-soft text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-0.02em] text-chalk">
        {t("title")}
      </h2>
      <p className="mt-4 max-w-[42ch] text-haze">
        {t("intro", { multiplier: GAME.multiplier })}
      </p>

      {!info ? (
        status === "loading" ? (
          <div className="mt-8 flex flex-col gap-4" aria-label={t("loading")}>
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <p className="mt-8 text-haze">{STATUS_TEXT[status]}</p>
        )
      ) : (
        <>
          <p className="mt-8 flex items-baseline gap-3">
            <AnimatedNumber value={info.bankroll} from={0} speed="slow" format={gnot} className="display-soft text-[clamp(3rem,7vw,5.5rem)] leading-none text-chalk" />
            <span className="text-lg text-haze">GNOT</span>
          </p>
          <dl className="mt-8 grid grid-cols-2 border-t border-border sm:grid-cols-3">
            <Stat label={t("maxBet")}>
              <AnimatedNumber value={info.maxCoverableBet} format={gnot} /> GNOT
            </Stat>
            <Stat label={t("games", { wins: info.totalWins })}>
              <AnimatedNumber value={info.totalGames} from={0} speed="slow" />
            </Stat>
            <Stat label={t("paid")}>
              <AnimatedNumber value={info.totalPaid} from={0} speed="slow" format={gnot} /> GNOT
            </Stat>
          </dl>
        </>
      )}

      {info?.paused && (
        <Alert variant="info" className="mt-6">
          <PauseCircle />
          <p>{t("paused")}</p>
        </Alert>
      )}

      {status === "live" && (
        <p className="mt-8 text-sm text-haze">
          {t("public")}{" "}
          <a href={contractUrl} target="_blank" rel="noreferrer">
            {t("readContract")}
          </a>
        </p>
      )}
    </section>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-border py-4 pr-4 sm:border-b-0 [&:not(:first-child)]:sm:border-l [&:not(:first-child)]:sm:pl-4">
      <dt className="text-sm text-haze">{label}</dt>
      <dd className="mt-1 text-xl font-medium tabular-nums text-chalk">{children}</dd>
    </div>
  );
}
