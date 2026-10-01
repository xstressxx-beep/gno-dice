"use client";

import Link from "next/link";
import { Info, WifiOff } from "lucide-react";
import { config } from "@/lib/config";
import { useGnodice } from "@/hooks/useGnodice";
import { Alert } from "@/components/ui/alert";
import { BankPanel } from "./BankPanel";
import { GameTable } from "./GameTable";
import { History } from "./History";
import { HowItWorks } from "./HowItWorks";
import { RollTicker } from "./RollTicker";
import { useWallet } from "./WalletProvider";

/** La page de jeu : la table (en haut), le fil des lancers, « Comment ça marche », puis la banque et l'historique. */
export function Casino() {
  const wallet = useWallet();
  const playerAddress = wallet.status === "connected" && !wallet.wrongNetwork ? wallet.address : null;
  const game = useGnodice(playerAddress);

  return (
    <>
      <div className="page-container">
        {game.status === "absent" && (
          <Alert variant="info" className="mt-4">
            <Info />
            <p>
              <strong>Le contrat GNO-DICE n’est pas encore déployé sur {config.chainName}.</strong> Propriétaire du site : déploie-le depuis la page{" "}
              <Link href="/admin">/admin</Link> avec ton wallet Adena.
            </p>
          </Alert>
        )}
        {game.status === "inert" && (
          <Alert variant="info" className="mt-4">
            <Info />
            <p>
              <strong>Le contrat vient d’être déployé.</strong> Le réseau le vérifie avant de l’activer, en général en quelques minutes. La page se
              mettra à jour toute seule.
            </p>
          </Alert>
        )}
        {game.status === "unreachable" && !game.info && (
          <Alert variant="destructive" className="mt-4">
            <WifiOff />
            <p>Le réseau Gno ne répond pas ({game.error}). Nouvel essai automatique dans quelques secondes.</p>
          </Alert>
        )}

        <GameTable info={game.info} player={game.player} status={game.status} clockOffset={game.clockOffset} refresh={game.refresh} />
      </div>

      <RollTicker recent={game.info?.recent ?? []} />

      <HowItWorks />

      <div className="border-t border-border/70">
        <div className="page-container grid gap-20 py-24 sm:py-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-24">
          <BankPanel info={game.info} status={game.status} />
          <History
            player={game.player}
            recent={game.info?.recent ?? []}
            contractLive={game.status === "live"}
            loading={playerAddress !== null && game.player === null && game.status !== "unreachable"}
          />
        </div>
      </div>
    </>
  );
}
