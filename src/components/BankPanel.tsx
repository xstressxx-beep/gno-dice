import { config, GAME } from "@/lib/config";
import { formatGnot, shortAddress } from "@/lib/format";
import type { GameInfo } from "@/lib/gno";
import { Die } from "./Die";
import styles from "./BankPanel.module.css";

type Props = {
  info: GameInfo | null;
  loading: boolean;
  error: string | null;
};

/** Colonne de droite : la banque du casino, les règles et les dernières parties. */
export function BankPanel({ info, loading, error }: Props) {
  const contractUrl = config.realmPath ? `${config.gnowebUrl}/${config.realmPath.replace(/^gno\.land\//, "")}` : null;

  return (
    <aside className={styles.panel}>
      <section className="card">
        <h2 className="card-title">Banque du casino</h2>
        {!config.realmPath ? (
          <p className="muted">Contrat non configuré.</p>
        ) : error && !info ? (
          <p className="notice notice-error">Impossible de lire le contrat : {error}</p>
        ) : !info ? (
          <p className="muted">{loading ? "Chargement…" : "—"}</p>
        ) : (
          <dl className={styles.stats}>
            <div>
              <dt>Solde de la banque</dt>
              <dd className="gold-text">{formatGnot(info.bankroll)} GNOT</dd>
            </div>
            <div>
              <dt>Mise max acceptée</dt>
              <dd>{formatGnot(info.maxCoverableBet)} GNOT</dd>
            </div>
            <div>
              <dt>Parties jouées</dt>
              <dd>
                {info.totalGames} <span className="muted">({info.totalWins} gagnées)</span>
              </dd>
            </div>
            <div>
              <dt>Total payé aux joueurs</dt>
              <dd>{formatGnot(info.totalPaid)} GNOT</dd>
            </div>
          </dl>
        )}
        {info?.paused && <p className="notice notice-info">⏸️ Le jeu est en pause.</p>}
      </section>

      <section className="card">
        <h2 className="card-title">Règles</h2>
        <ol className={styles.rules}>
          <li>Choisis un chiffre de 1 à 6.</li>
          <li>
            Mise entre {GAME.minBetGnot} et {GAME.maxBetGnot} GNOT.
          </li>
          <li>
            Si le dé tombe sur ton chiffre, tu gagnes <strong className="gold-text">{GAME.multiplier}× ta mise</strong>.
          </li>
          <li>Un lancer toutes les 10 minutes par joueur.</li>
        </ol>
        <p className={`${styles.small} muted`}>
          Tout se passe sur la blockchain : le contrat reçoit ta mise, lance le dé et te paie automatiquement.
          {contractUrl && (
            <>
              {" "}
              <a href={contractUrl} target="_blank" rel="noreferrer">
                Voir le contrat
              </a>
            </>
          )}
        </p>
      </section>

      {info && info.recent.length > 0 && (
        <section className="card">
          <h2 className="card-title">Derniers lancers</h2>
          <ul className={styles.feed}>
            {info.recent.slice(0, 6).map((g) => (
              <li key={g.id}>
                <Die value={g.roll} size={24} />
                <span className={styles.feedText}>
                  <span className={styles.mono}>{shortAddress(g.player)}</span> a misé {formatGnot(g.bet)} sur {g.guess}
                </span>
                {g.won ? <span className={styles.win}>+{formatGnot(g.payout)}</span> : <span className={styles.lose}>perdu</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
