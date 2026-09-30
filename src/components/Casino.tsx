"use client";

import Link from "next/link";
import { config } from "@/lib/config";
import { useGnodice } from "@/hooks/useGnodice";
import { BankPanel } from "./BankPanel";
import { GameTable } from "./GameTable";
import { History } from "./History";
import { useWallet } from "./WalletProvider";
import styles from "./Casino.module.css";

/** Assemble la page de jeu : table, banque et historique partagent les mêmes données. */
export function Casino() {
  const wallet = useWallet();
  const playerAddress = wallet.status === "connected" && !wallet.wrongNetwork ? wallet.address : null;
  const game = useGnodice(playerAddress);

  return (
    <>
      {!config.realmPath && (
        <p className={`notice notice-info ${styles.setup}`}>
          <strong>Contrat pas encore configuré.</strong> Propriétaire du site : déploie le contrat depuis la page{" "}
          <Link href="/admin">/admin</Link>, puis renseigne la variable <code>NEXT_PUBLIC_GNODICE_REALM</code> sur Vercel (voir le README).
        </p>
      )}
      <div className={styles.grid}>
        <GameTable info={game.info} player={game.player} clockOffset={game.clockOffset} dataError={game.error} refresh={game.refresh} />
        <BankPanel info={game.info} loading={game.loading} error={game.error} />
      </div>
      <History player={game.player} loading={game.loading || (playerAddress !== null && game.player === null && !game.error)} />
    </>
  );
}
