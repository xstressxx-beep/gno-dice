"use client";

import { config } from "@/lib/config";
import { formatDate, formatGnot } from "@/lib/format";
import type { PlayerInfo } from "@/lib/gno";
import { Die } from "./Die";
import { useWallet } from "./WalletProvider";
import styles from "./History.module.css";

type Props = {
  player: PlayerInfo | null;
  loading: boolean;
};

/**
 * Les 10 dernières parties du joueur connecté.
 * Les données viennent directement du contrat (fonction GetPlayerJSON).
 */
export function History({ player, loading }: Props) {
  const wallet = useWallet();
  const connected = wallet.status === "connected" && !wallet.wrongNetwork;

  let content;
  if (!config.realmPath) {
    content = <p className="muted">L’historique s’affichera dès que le contrat sera configuré.</p>;
  } else if (!connected) {
    content = <p className="muted">Connecte ton wallet Adena pour voir tes 10 dernières parties.</p>;
  } else if (!player) {
    content = loading ? <SkeletonRows /> : <p className="muted">Historique indisponible pour le moment.</p>;
  } else if (player.history.length === 0) {
    content = <p className="muted">Aucune partie pour l’instant. Lance le dé pour commencer !</p>;
  } else {
    content = (
      <>
        <p className={styles.summary}>
          <span>
            <strong>{player.played}</strong> partie{player.played > 1 ? "s" : ""}
          </span>
          <span>
            <strong>{player.wins}</strong> gagnée{player.wins > 1 ? "s" : ""}
          </span>
          <span>
            Total misé <strong>{formatGnot(player.wagered)} GNOT</strong>
          </span>
          <span>
            Total gagné <strong className="gold-text">{formatGnot(player.paid)} GNOT</strong>
          </span>
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Mise</th>
                <th scope="col">Chiffre joué</th>
                <th scope="col">Dé</th>
                <th scope="col">Résultat</th>
              </tr>
            </thead>
            <tbody>
              {player.history.map((game) => (
                <tr key={game.id}>
                  <td data-label="Date">{formatDate(game.time)}</td>
                  <td data-label="Mise">{formatGnot(game.bet)} GNOT</td>
                  <td data-label="Chiffre joué">
                    <span className={styles.dieCell}>
                      <Die value={game.guess} size={26} variant="gold" label={`Chiffre joué : ${game.guess}`} />
                    </span>
                  </td>
                  <td data-label="Dé">
                    <span className={styles.dieCell}>
                      <Die value={game.roll} size={26} label={`Résultat du dé : ${game.roll}`} />
                    </span>
                  </td>
                  <td data-label="Résultat">
                    {game.won ? (
                      <span className={`${styles.badge} ${styles.won}`}>Gagné · +{formatGnot(game.payout)} GNOT</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.lost}`}>Perdu</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <section className="card" aria-labelledby="history-title">
      <h2 id="history-title" className="card-title">
        Tes 10 dernières parties
      </h2>
      {content}
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className={styles.skeleton} aria-label="Chargement de l’historique">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}
