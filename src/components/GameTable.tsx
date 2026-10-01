"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Info, Timer } from "lucide-react";
import { ADENA_DOWNLOAD_URL, sendTransaction } from "@/lib/adena";
import { config, FIRST_GAME_DEPOSIT_UGNOT, GAME, GAS, NEXT_GAME_DEPOSIT_UGNOT } from "@/lib/config";
import { formatCountdown, formatGnot, UGNOT_PER_GNOT } from "@/lib/format";
import { haptic, RED, sparkBurstFrom } from "@/lib/fx";
import { estimateFee, type GameInfo, type PlayerInfo } from "@/lib/gno";
import { parsePlayResult, playMessage } from "@/lib/gnodice";
import type { ContractStatus } from "@/hooks/useGnodice";
import { useNow } from "@/hooks/useNow";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedNumber } from "./AnimatedNumber";
import { BetControl } from "./BetControl";
import { DiceStage, type Outcome } from "./DiceStage";
import { NumberPicker } from "./NumberPicker";
import { PlayButton, type PlayAction } from "./PlayButton";
import { ScreenFlash, type Flash } from "./ScreenFlash";
import { WinExplosion } from "./WinExplosion";
import { useWallet } from "./WalletProvider";

type Props = {
  info: GameInfo | null;
  player: PlayerInfo | null;
  status: ContractStatus;
  clockOffset: number;
  refresh: () => Promise<PlayerInfo | null>;
};

const DEFAULT_FEE_UGNOT = 25_000;
// Si le dé n'a pas signalé qu'il s'est posé (onglet en arrière-plan…), on
// affiche quand même le résultat au bout de ce délai.
const REVEAL_FALLBACK_MS = 2800;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** La table de jeu : scène du dé, choix du chiffre, mise, bouton JOUER et résultat. */
export function GameTable({ info, player, status, clockOffset, refresh }: Props) {
  const wallet = useWallet();
  const now = useNow();

  const [guess, setGuess] = useState<number | null>(null);
  const [bet, setBet] = useState(GAME.minBetGnot);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [winBurst, setWinBurst] = useState(0);
  const [txError, setTxError] = useState<string | null>(null);
  const [fee, setFee] = useState(DEFAULT_FEE_UGNOT);
  const [flash, setFlash] = useState<Flash | null>(null);
  // Secousse de la table (atterrissage du dé, victoire, défaite)
  const shake = useAnimationControls();

  const dieRef = useRef<HTMLDivElement>(null);
  // Le lancer en cours et celui déjà dévoilé (pour ne fêter une victoire qu'une fois).
  const outcomeRef = useRef<Outcome | null>(null);
  const revealedRef = useRef<Outcome | null>(null);

  // Frais réseau estimés pour un lancer (lus une fois au chargement).
  useEffect(() => {
    estimateFee(GAS.play).then(setFee).catch(() => undefined);
  }, []);

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

  // Le dé s'est posé : on dévoile le résultat (et on fête une victoire une seule fois).
  const reveal = useCallback(() => {
    const current = outcomeRef.current;
    if (!current || revealedRef.current === current) return;
    revealedRef.current = current;
    setRevealed(true);
    setFlash({ kind: current.won ? "win" : "lose", id: Date.now() });
    if (current.won) {
      setWinBurst((n) => n + 1);
      shake.start({ scale: [1, 1.015, 1], transition: { duration: 0.5, ease: "easeOut" } });
    } else {
      shake.start({ x: [0, -9, 8, -6, 4, 0], transition: { duration: 0.45 } });
    }
  }, [shake]);

  // Chaque rebond du dé fait vibrer la table, d'autant plus fort que le choc est violent.
  const impact = useCallback(
    (strength: number) => {
      shake.start({ y: [0, 3 * strength, 0], transition: { duration: 0.18, ease: "easeOut" } });
      haptic(Math.round(10 + 20 * strength));
    },
    [shake],
  );

  /** Clic sur JOUER : étincelles rouges + vibration, puis le lancer. */
  function launch(e?: MouseEvent<HTMLElement>) {
    sparkBurstFrom(e?.currentTarget, { colors: RED, count: 18, spread: 110 });
    haptic(20);
    void play();
  }

  async function play() {
    if (!wallet.address || guess === null) return;
    const chosen = guess;
    const lastGameId = player?.history[0]?.id ?? 0;
    setTxError(null);
    setOutcome(null);
    setRevealed(false);
    outcomeRef.current = null;
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
      if (result) {
        const next = { guess: chosen, bet, ...result };
        outcomeRef.current = next;
        setOutcome(next);
        window.setTimeout(reveal, REVEAL_FALLBACK_MS);
      } else {
        setTxError("Lancer envoyé, mais le résultat n'est pas encore visible. Il apparaîtra dans ton historique.");
      }
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
      // On relit l'historique et le solde une fois le dé posé, pour ne pas dévoiler le résultat avant l'animation.
      const sync = () => {
        refresh();
        wallet.refreshBalance();
      };
      if (outcomeRef.current) window.setTimeout(sync, REVEAL_FALLBACK_MS);
      else sync();
    }
  }

  // --- Bouton principal : son texte et son action dépendent de la situation ---
  let action: PlayAction;
  if (status === "absent") action = { label: "Contrat pas encore déployé", disabled: true };
  else if (status === "inert") action = { label: "Activation du contrat…", disabled: true };
  else if (status === "loading") action = { label: "Chargement du jeu…", disabled: true, busy: true };
  else if (!info) action = { label: "Réseau Gno injoignable", disabled: true };
  else if (wallet.status === "no-extension") action = { label: "Installer Adena pour jouer", href: ADENA_DOWNLOAD_URL };
  else if (wallet.status !== "connected")
    action = { label: "Connecter Adena pour jouer", onClick: wallet.connect, disabled: wallet.status === "connecting" || wallet.status === "checking" };
  else if (wallet.wrongNetwork) action = { label: `Passer sur ${config.chainName}`, onClick: wallet.switchNetwork };
  else if (pending) action = { label: "Le dé roule…", disabled: true, busy: true };
  else if (info.paused) action = { label: "Jeu en pause", disabled: true };
  else if (cooldownLeft > 0) action = { label: `Prochain lancer dans ${formatCountdown(cooldownLeft)}`, disabled: true };
  else if (guess === null) action = { label: "Choisis un chiffre", disabled: true };
  else if (bet > maxCoverable)
    action = { label: maxCoverable >= minBet ? `Mise max possible : ${maxCoverable} GNOT` : "La banque est vide", disabled: true };
  else if (notEnoughFunds) action = { label: "Solde insuffisant", disabled: true };
  else action = { label: `Jouer · ${bet} GNOT`, onClick: launch };

  return (
    <motion.div animate={shake}>
    <Card className="overflow-hidden border-primary/30" aria-labelledby="table-title">
      <h2 id="table-title" className="sr-only">
        Table de jeu
      </h2>

      <DiceStage
        pending={pending}
        outcome={outcome}
        revealed={revealed}
        guess={guess}
        multiplier={multiplier}
        onLanded={reveal}
        onImpact={impact}
        dieRef={dieRef}
      />
      <WinExplosion burst={winBurst} originRef={dieRef} />
      <ScreenFlash flash={flash} />

      <div className="flex flex-col gap-6 p-5 sm:p-7">
        {/* Étape 1 : le chiffre */}
        <section className="flex flex-col gap-3" aria-labelledby="step-guess">
          <StepLabel id="step-guess" n={1}>
            Choisis ton chiffre
          </StepLabel>
          <NumberPicker value={guess} onChange={setGuess} disabled={pending} />
        </section>

        {/* Étape 2 : la mise */}
        <section className="flex flex-col gap-3" aria-labelledby="step-bet">
          <StepLabel id="step-bet" n={2}>
            Ta mise
          </StepLabel>
          <BetControl value={bet} min={minBet} max={maxBet} onChange={setBet} disabled={pending} />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">Gain possible :</span>
            <strong className="font-display text-lg">
              <AnimatedNumber value={bet * multiplier} className="gold-text tabular-nums" /> <span className="text-primary">GNOT</span>
            </strong>
            <span className="text-muted-foreground">· 1 chance sur 6</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  <Info className="size-3.5" /> frais
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Frais réseau ≈ {formatGnot(fee, 3)} GNOT
                {firstGame && " (+ ~0,44 GNOT de dépôt de stockage à ta 1re partie)"}
              </TooltipContent>
            </Tooltip>
          </p>
        </section>

        {/* Bouton JOUER */}
        <PlayButton action={action} />

        {cooldownLeft > 0 && (
          <div className="flex flex-col gap-2" aria-live="polite">
            <Progress value={Math.round(cooldownProgress * 100)} aria-label="Temps avant le prochain lancer" />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="size-4 text-primary" />
              Un lancer toutes les 10 minutes : reviens dans <strong className="font-mono text-foreground">{formatCountdown(cooldownLeft)}</strong>
            </p>
          </div>
        )}

        {txError && <Alert variant="destructive">{txError}</Alert>}
        {wallet.error && <Alert variant="destructive">{wallet.error}</Alert>}
        {notEnoughFunds && wallet.status === "connected" && !wallet.wrongNetwork && config.faucetUrl && (
          <Alert variant="info">
            Il te faut au moins {formatGnot(needed)} GNOT (mise + frais{firstGame ? " + dépôt de 1re partie" : ""}). Sur le testnet, tu peux
            obtenir des GNOT gratuits sur le{" "}
            <a href={config.faucetUrl} target="_blank" rel="noreferrer">
              faucet
            </a>
            .
          </Alert>
        )}
      </div>
    </Card>
    </motion.div>
  );
}

function StepLabel({ id, n, children }: { id: string; n: number; children: ReactNode }) {
  return (
    <h3 id={id} className="flex items-center gap-2.5 font-display text-sm font-bold uppercase tracking-[0.16em] text-gold-100 sm:text-base">
      <span className="grid size-6 place-items-center rounded-full bg-gold-gradient font-sans text-xs font-extrabold text-primary-foreground shadow-gold">
        {n}
      </span>
      {children}
    </h3>
  );
}
