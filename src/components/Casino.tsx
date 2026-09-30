"use client";

import Link from "next/link";
import { Info, WifiOff } from "lucide-react";
import { config } from "@/lib/config";
import { useGnodice } from "@/hooks/useGnodice";
import { Alert } from "@/components/ui/alert";
import { BankPanel } from "./BankPanel";
import { GameTable } from "./GameTable";
import { History } from "./History";
import { useWallet } from "./WalletProvider";

/** Assemble la page de jeu : table, banque et historique partagent les mêmes données. */
export function Casino() {
  const wallet = useWallet();
  const playerAddress = wallet.status === "connected" && !wallet.wrongNetwork ? wallet.address : null;
  const game = useGnodice(playerAddress);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      {game.status === "absent" && (
        <Alert variant="info">
          <Info />
          <p>
            <strong>Le contrat GNO-DICE n’est pas encore déployé sur {config.chainName}.</strong> Propriétaire du site : déploie-le en
            quelques clics depuis la page <Link href="/admin">/admin</Link> avec ton wallet Adena.
          </p>
        </Alert>
      )}
      {game.status === "inert" && (
        <Alert variant="info">
          <Info />
          <p>
            <strong>Le contrat vient d’être déployé.</strong> Le réseau le vérifie avant de l’activer (en général quelques minutes) : la
            page se mettra à jour toute seule.
          </p>
        </Alert>
      )}
      {game.status === "unreachable" && !game.info && (
        <Alert variant="destructive">
          <WifiOff />
          <p>Impossible de joindre le réseau Gno pour le moment ({game.error}). Nouvel essai automatique dans quelques secondes…</p>
        </Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-6">
        <GameTable info={game.info} player={game.player} status={game.status} clockOffset={game.clockOffset} refresh={game.refresh} />
        <BankPanel info={game.info} status={game.status} />
      </div>

      <History
        player={game.player}
        recent={game.info?.recent ?? []}
        contractLive={game.status === "live"}
        loading={playerAddress !== null && game.player === null && game.status !== "unreachable"}
      />
    </div>
  );
}
