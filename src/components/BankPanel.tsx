import type { ReactNode } from "react";
import { Coins, Landmark, PauseCircle, ScrollText } from "lucide-react";
import { config, GAME } from "@/lib/config";
import { formatGnot } from "@/lib/format";
import type { GameInfo } from "@/lib/gno";
import type { ContractStatus } from "@/hooks/useGnodice";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

type Props = {
  info: GameInfo | null;
  status: ContractStatus;
};

const STATUS_TEXT: Record<ContractStatus, string> = {
  loading: "Chargement…",
  live: "",
  absent: "Contrat pas encore déployé.",
  inert: "Contrat en cours d’activation…",
  unreachable: "Réseau injoignable pour le moment.",
};

const gnot = (n: number) => formatGnot(n);

/** Colonne de droite : la banque du casino et les règles. */
export function BankPanel({ info, status }: Props) {
  const contractUrl = `${config.gnowebUrl}/${config.realmPath.replace(/^gno\.land\//, "")}`;

  return (
    <aside className="flex flex-col gap-5 lg:gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="size-4" /> Banque du casino
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!info ? (
            status === "loading" ? (
              <div className="flex flex-col gap-3" aria-label="Chargement de la banque">
                <Skeleton className="h-20 w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{STATUS_TEXT[status]}</p>
            )
          ) : (
            <>
              {/* Le coffre : solde qui défile jusqu'à sa valeur au chargement */}
              <div className="relative overflow-hidden rounded-md border border-primary/25 bg-gradient-to-b from-primary/10 to-black/40 px-4 py-4 text-center">
                <Coins aria-hidden className="absolute -bottom-5 -right-3 size-24 -rotate-12 text-primary/[0.07]" />
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Solde de la banque</p>
                <p className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
                  <AnimatedNumber value={info.bankroll} from={0} speed="slow" format={gnot} className="gold-text tabular-nums" />
                  <span className="ml-2 text-base text-primary">GNOT</span>
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <Stat label="Mise max acceptée">
                  <AnimatedNumber value={info.maxCoverableBet} format={gnot} /> GNOT
                </Stat>
                <Stat label="Parties jouées">
                  <AnimatedNumber value={info.totalGames} from={0} speed="slow" />{" "}
                  <span className="text-xs font-medium text-muted-foreground">({info.totalWins} gagnées)</span>
                </Stat>
                <Stat label="Payé aux joueurs" className="col-span-2">
                  <AnimatedNumber value={info.totalPaid} from={0} speed="slow" format={gnot} className="text-win" /> GNOT
                </Stat>
              </dl>
            </>
          )}
          {info?.paused && (
            <Alert variant="info">
              <PauseCircle />
              <p>Le jeu est en pause.</p>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4" /> Règles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            <Rule n={1}>Choisis un chiffre de 1 à 6.</Rule>
            <Rule n={2}>
              Mise entre {GAME.minBetGnot} et {GAME.maxBetGnot} GNOT.
            </Rule>
            <Rule n={3}>
              Si le dé tombe sur ton chiffre, tu gagnes <strong className="gold-text">{GAME.multiplier}× ta mise</strong>.
            </Rule>
            <Rule n={4}>Un lancer toutes les 10 minutes par joueur.</Rule>
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            Tout se passe sur la blockchain : le contrat reçoit ta mise, lance le dé et te paie automatiquement.
            {status === "live" && (
              <>
                {" "}
                <a href={contractUrl} target="_blank" rel="noreferrer">
                  Voir le contrat
                </a>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}

function Stat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border border-primary/10 bg-black/35 px-3 py-2.5", className)}>
      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{children}</dd>
    </div>
  );
}

function Rule({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-primary/50 bg-primary/10 font-display text-xs font-bold text-primary">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
