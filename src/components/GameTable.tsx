"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ADENA_DOWNLOAD_URL, sendTransaction } from "@/lib/adena";
import { config, FIRST_GAME_DEPOSIT_UGNOT, GAME, GAS, NEXT_GAME_DEPOSIT_UGNOT } from "@/lib/config";
import { formatCountdown, formatGnot, UGNOT_PER_GNOT } from "@/lib/format";
import { estimateFee, type GameInfo, type PlayerInfo } from "@/lib/gno";
import { parsePlayResult, playMessage } from "@/lib/gnodice";
import type { ContractStatus } from "@/hooks/useGnodice";
import { useNow } from "@/hooks/useNow";
import { Die } from "./Die";
import { useWallet } from "./WalletProvider";
import styles from "./GameTable.module.css";

type Props = {
  info: GameInfo | null;
  player: PlayerInfo | null;
  status: ContractStatus;
  clockOffset: number;
  refresh: () => Promise<PlayerInfo | null>;
};

type Outcome = { guess: number; bet: number; roll: number; won: boolean; payout: number };

const CHIPS = [1, 2, 5, 10];
const DEFAULT_FEE_UGNOT = 25_000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** La table de jeu : choix du chiffre, mise, lancer et résultat. */
export function GameTable({ info, player, status, clockOffset, refresh }: Props) {
  const wallet = useWallet();
  const now = useNow();

  const [guess, setGuess] = useState<number | null>(null);
  const [bet, setBet] = useState(GAME.minBetGnot);
  const [pending, setPending] = useState(false);
  const [rollingFace, setRollingFace] = useState(1);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [fee, setFee] = useState(DEFAULT_FEE_UGNOT);

  // Frais réseau estimés pour un lancer (lus une fois au chargement).
  useEffect(() => {
    estimateFee(GAS.play).then(setFee).catch(() => undefined);
  }, []);

  // Pendant la transaction, le dé « roule » : on change de face très vite.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setRollingFace((f) => ((f + Math.floor(Math.random() * 5)) % 6) + 1), 110);
    return () => clearInterval(timer);
  }, [pending]);

  // Règles lues dans le contrat (avec des valeurs par défaut en attendant).
  const minBet = info ? info.minBet / UGNOT_PER_GNOT : GAME.minBetGnot;
  const maxBet = info ? info.maxBet / UGNOT_PER_GNOT : GAME.maxBetGnot;
  const multiplier = info?.multiplier ?? GAME.multiplier;
  const cooldownTotal = info?.cooldown ?? GAME.cooldownSeconds;
  const maxCoverable = info ? Math.floor(info.maxCoverableBet / UGNOT_PER_GNOT) : maxBet;

  // Temps d'attente avant le prochain lancer, calé sur l'horloge de la blockchain.
  const chainNow = now + clockOffset;
  const cooldownLeft = now > 0 && player && player.nextPlayAt > 0 ? Math.max(0, player.nextPlayAt - chainNow) : 0;
  const cooldownProgress = cooldownLeft > 0 ? 1 - cooldownLeft / cooldownTotal : 1;

  const betUgnot = bet * UGNOT_PER_GNOT;
  // La 1re partie d'un joueur bloque un petit dépôt de stockage (sa fiche sur la blockchain).
  const firstGame = !player || player.played === 0;
  const deposit = firstGame ? FIRST_GAME_DEPOSIT_UGNOT : NEXT_GAME_DEPOSIT_UGNOT;
  const needed = betUgnot + fee + deposit;
  const notEnoughFunds = wallet.balance !== null && wallet.balance < needed;

  async function play() {
    if (!wallet.address || guess === null) return;
    const chosen = guess;
    const lastGameId = player?.history[0]?.id ?? 0;
    setTxError(null);
    setOutcome(null);
    setPending(true);
    try {
      const currentFee = await estimateFee(GAS.play);
      const tx = await sendTransaction([playMessage(wallet.address, chosen, betUgnot)], GAS.play, currentFee);

      // 1) Le résultat renvoyé directement par la transaction.
      let result = parsePlayResult(tx.returned);
      // 2) Sinon, on le lit dans l'historique du contrat (source de vérité).
      for (let attempt = 0; !result && attempt < 6; attempt++) {
        const fresh = await refresh();
        const last = fresh?.history[0];
        if (last && last.id !== lastGameId) result = { roll: last.roll, won: last.won, payout: last.payout };
        else await wait(1500);
      }
      if (result) setOutcome({ guess: chosen, bet, ...result });
      else setTxError("Lancer envoyé, mais le résultat n'est pas encore visible. Il apparaîtra dans ton historique.");
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
      refresh();
      wallet.refreshBalance();
    }
  }

  // --- Bouton principal : son texte et son action dépendent de la situation ---
  let button: { label: string; onClick?: () => void; href?: string; disabled?: boolean };
  if (status === "absent") button = { label: "Contrat pas encore déployé", disabled: true };
  else if (status === "inert") button = { label: "Activation du contrat en cours…", disabled: true };
  else if (status === "loading") button = { label: "Chargement du jeu…", disabled: true };
  else if (!info) button = { label: "Réseau Gno injoignable", disabled: true };
  else if (wallet.status === "no-extension") button = { label: "Installer Adena pour jouer", href: ADENA_DOWNLOAD_URL };
  else if (wallet.status !== "connected") button = { label: "Connecter Adena pour jouer", onClick: wallet.connect, disabled: wallet.status === "connecting" || wallet.status === "checking" };
  else if (wallet.wrongNetwork) button = { label: `Passer sur ${config.chainName}`, onClick: wallet.switchNetwork };
  else if (pending) button = { label: "Le dé roule…", disabled: true };
  else if (info.paused) button = { label: "Jeu en pause", disabled: true };
  else if (cooldownLeft > 0) button = { label: `Prochain lancer dans ${formatCountdown(cooldownLeft)}`, disabled: true };
  else if (guess === null) button = { label: "Choisis un chiffre", disabled: true };
  else if (bet > maxCoverable) button = { label: maxCoverable >= minBet ? `Mise max possible : ${maxCoverable} GNOT` : "La banque est vide", disabled: true };
  else if (notEnoughFunds) button = { label: "Solde insuffisant", disabled: true };
  else button = { label: `Lancer le dé · ${bet} GNOT`, onClick: play };

  return (
    <section className={`${styles.table}`} aria-labelledby="table-title">
      <h2 id="table-title" className="visually-hidden">
        Table de jeu
      </h2>

      {/* Étape 1 : le chiffre */}
      <div className={styles.step}>
        <p className={styles.stepLabel}>
          <span className={styles.stepNum}>1</span> Choisis ton chiffre
        </p>
        <div className={styles.picker} role="radiogroup" aria-label="Chiffre choisi">
          {GAME.faces.map((face) => (
            <button
              key={face}
              type="button"
              role="radio"
              aria-checked={guess === face}
              aria-label={`Chiffre ${face}`}
              className={`${styles.face} ${guess === face ? styles.faceSelected : ""}`}
              onClick={() => setGuess(face)}
              disabled={pending}
            >
              <Die value={face} size={58} variant={guess === face ? "gold" : "ivory"} />
            </button>
          ))}
        </div>
      </div>

      {/* Étape 2 : la mise */}
      <div className={styles.step}>
        <p className={styles.stepLabel}>
          <span className={styles.stepNum}>2</span> Ta mise
        </p>
        <div className={styles.betRow}>
          <div className={styles.stepper}>
            <button type="button" className={styles.stepperBtn} onClick={() => setBet((b) => Math.max(minBet, b - 1))} disabled={pending || bet <= minBet} aria-label="Diminuer la mise">
              −
            </button>
            <label className={styles.betValue}>
              <input
                type="number"
                inputMode="numeric"
                min={minBet}
                max={maxBet}
                step={1}
                value={bet}
                disabled={pending}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (Number.isFinite(v)) setBet(Math.min(maxBet, Math.max(minBet, v)));
                }}
                aria-label="Mise en GNOT"
              />
              <span>GNOT</span>
            </label>
            <button type="button" className={styles.stepperBtn} onClick={() => setBet((b) => Math.min(maxBet, b + 1))} disabled={pending || bet >= maxBet} aria-label="Augmenter la mise">
              +
            </button>
          </div>
          <div className={styles.chips}>
            {CHIPS.map((c) => (
              <button key={c} type="button" className={`${styles.chip} ${styles[`chip${c}`]} ${bet === c ? styles.chipActive : ""}`} onClick={() => setBet(c)} disabled={pending} aria-label={`Miser ${c} GNOT`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.potential}>
          Gain possible : <strong className="gold-text">{bet * multiplier} GNOT</strong>
          <span className="muted">
            {" "}
            · 1 chance sur 6 · frais réseau ≈ {formatGnot(fee, 3)} GNOT
            {firstGame && " (+ ~0,44 GNOT de dépôt de stockage à ta 1re partie)"}
          </span>
        </p>
      </div>

      {/* Bouton principal */}
      {button.href ? (
        <a className={`btn btn-gold ${styles.cta}`} href={button.href} target="_blank" rel="noreferrer">
          {button.label}
        </a>
      ) : (
        <button type="button" className={`btn btn-gold ${styles.cta}`} onClick={button.onClick} disabled={button.disabled}>
          {button.label}
        </button>
      )}

      {cooldownLeft > 0 && (
        <div className={styles.cooldown} aria-live="polite">
          <div className={styles.cooldownBar}>
            <div className={styles.cooldownFill} style={{ width: `${Math.round(cooldownProgress * 100)}%` }} />
          </div>
          <p className="muted">Un lancer toutes les 10 minutes : reviens dans {formatCountdown(cooldownLeft)}.</p>
        </div>
      )}

      {/* Zone de résultat */}
      <div className={styles.stage} aria-live="polite">
        {pending ? (
          <>
            <Die value={rollingFace} size={112} className={styles.rolling} />
            <p className={styles.stageText}>Confirme dans Adena… puis le dé est lancé sur la blockchain.</p>
          </>
        ) : outcome ? (
          <div className={`${styles.outcome} ${outcome.won ? styles.win : styles.lose}`}>
            <Die value={outcome.roll} size={112} variant={outcome.won ? "gold" : "ivory"} className={styles.landed} label={`Le dé est tombé sur ${outcome.roll}`} />
            {outcome.won ? (
              <>
                <p className={styles.bigWin}>GAGNÉ !</p>
                <p>
                  Le dé est tombé sur <strong>{outcome.roll}</strong> : tu remportes <strong className="gold-text">{formatGnot(outcome.payout)} GNOT</strong> 🎉
                </p>
                <div className={styles.confetti} aria-hidden>
                  {Array.from({ length: 14 }, (_, i) => (
                    <span key={i} style={{ "--i": i } as CSSProperties} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className={styles.bigLose}>Perdu…</p>
                <p>
                  Le dé est tombé sur <strong>{outcome.roll}</strong>, tu avais choisi <strong>{outcome.guess}</strong>. Retente ta chance dans 10 minutes !
                </p>
              </>
            )}
          </div>
        ) : (
          <p className={`${styles.stageText} muted`}>Choisis un chiffre, fixe ta mise et lance le dé. Si le dé tombe sur ton chiffre, tu gagnes {multiplier} fois ta mise.</p>
        )}
      </div>

      {txError && <p className="notice notice-error">{txError}</p>}
      {wallet.error && <p className="notice notice-error">{wallet.error}</p>}
      {notEnoughFunds && wallet.status === "connected" && !wallet.wrongNetwork && config.faucetUrl && (
        <p className="notice notice-info">
          Il te faut au moins {formatGnot(needed)} GNOT (mise + frais{firstGame ? " + dépôt de 1re partie" : ""}). Sur le testnet, tu peux
          obtenir des GNOT gratuits sur le{" "}
          <a href={config.faucetUrl} target="_blank" rel="noreferrer">
            faucet
          </a>
          .
        </p>
      )}
    </section>
  );
}
