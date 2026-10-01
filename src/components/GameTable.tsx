"use client";

// La table de jeu, qui est aussi le haut de la page :
// titre, choix du chiffre et de la mise, bouton « Lancer », et le dé 3D.
// - le titre change de graisse en défilant (police variable Fraunces)
// - raccourcis clavier : 1 à 6 pour le chiffre, + / − pour la mise, Entrée pour lancer
// - chaque rebond du dé fait vibrer la table ; gagné / perdu : flash des bords et vibration

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimationControls, useScroll, useTransform } from "framer-motion";
import { Info, Timer } from "lucide-react";
import { ADENA_DOWNLOAD_URL, sendTransaction } from "@/lib/adena";
import { config, FIRST_GAME_DEPOSIT_UGNOT, GAME, GAS, NEXT_GAME_DEPOSIT_UGNOT } from "@/lib/config";
import { haptic, RUBY, sparkBurstFrom } from "@/lib/fx";
import { formatCountdown, formatGnot, UGNOT_PER_GNOT } from "@/lib/format";
import { requestResolve, requestReveal } from "@/lib/croupierClient";
import { commitment, randomHex32, rollFor } from "@/lib/fairness";
import { estimateFee, fetchGame, type Game, type GameInfo, type PlayerInfo } from "@/lib/gno";
import { parsePlayId, playMessage } from "@/lib/gnodice";
import { forgetSecret, saveSecret, setSecretId } from "@/lib/secrets";
import type { ContractStatus } from "@/hooks/useGnodice";
import { useIntroDone } from "@/hooks/useIntroDone";
import { useNow } from "@/hooks/useNow";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedNumber } from "./AnimatedNumber";
import { BetControl } from "./BetControl";
import { DieStage } from "./DieStage";
import type { SceneFx } from "./DieScene";
import { NumberPicker } from "./NumberPicker";
import { OpenGames } from "./OpenGames";
import { PlayButton, type PlayAction } from "./PlayButton";
import { ScreenFlash, type Flash } from "./ScreenFlash";
import { useWallet } from "./WalletProvider";

export type Outcome = { id: number; guess: number; bet: number; roll: number; won: boolean; payout: number };

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
const REVEAL_FALLBACK_MS = 4500;
const EASE = [0.16, 1, 0.3, 1] as const;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TITLE = ["Six faces.", "Une seule", "est la tienne."];

export function GameTable({ info, player, status, clockOffset, refresh }: Props) {
  const wallet = useWallet();
  const now = useNow();
  const introDone = useIntroDone();

  const [guess, setGuess] = useState<number | null>(null);
  const [bet, setBet] = useState(GAME.minBetGnot);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  // Fin de la partie en cours : versement relayé par le croupier, ou à signer soi-même
  const [settlement, setSettlement] = useState<"idle" | "settling" | "done" | "manual">("idle");
  const busy = useRef(false);
  const [fee, setFee] = useState(DEFAULT_FEE_UGNOT);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [sceneFx, setSceneFx] = useState<SceneFx>(null);
  // La table tremble aux rebonds du dé
  const shake = useAnimationControls();
  const playRef = useRef<HTMLDivElement>(null);

  // Le lancer en cours et celui déjà dévoilé (pour ne fêter une victoire qu'une fois).
  const outcomeRef = useRef<Outcome | null>(null);
  const revealedRef = useRef<Outcome | null>(null);

  // Titre : la graisse et la douceur de la police suivent le défilement
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const titleAxes = useTransform(scrollYProgress, [0, 0.6], [0, 1]);
  const fontVariationSettings = useTransform(
    titleAxes,
    (p) => `"wght" ${Math.round(780 - p * 480)}, "SOFT" ${Math.round(100 - p * 100)}, "WONK" 1, "opsz" 144`,
  );

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
    const kind = current.won ? "win" : "lose";
    setFlash({ kind, id: current.id });
    setSceneFx({ kind, id: current.id });
  }, []);

  const impact = useCallback(
    (strength: number) => {
      shake.start({ y: [0, 4 * strength, 0], transition: { duration: 0.2, ease: "easeOut" } });
    },
    [shake],
  );

  /**
   * Une partie en 3 étapes (voir contract/gnodice/gnodice.gno) :
   * 1. on mise sur un chiffre CACHÉ (son empreinte), après avoir gardé le
   *    chiffre et le secret dans le navigateur ;
   * 2. le croupier tire le dé sans connaître le chiffre ; le site refait le
   *    calcul avec la graine publiée pour vérifier le tirage ;
   * 3. le chiffre est dévoilé (relayé par le croupier, sinon signé par le
   *    joueur) et le contrat paie en cas de victoire.
   */
  async function play() {
    // Verrou : un double clic ne peut pas envoyer deux mises.
    if (busy.current || !wallet.address || guess === null) return;
    busy.current = true;
    const chosen = guess;
    const address = wallet.address;
    setTxError(null);
    setSettlement("idle");
    setOutcome(null);
    setRevealed(false);
    outcomeRef.current = null;
    setPending(true);
    try {
      const salt = randomHex32();
      const commit = await commitment(address, chosen, salt);
      if (!saveSecret({ player: address, commitment: commit, guess: chosen, salt })) {
        throw new Error("Ton navigateur bloque le stockage local : impossible de garder ton chiffre secret. Autorise-le pour jouer.");
      }

      const currentFee = await estimateFee(GAS.play);
      const tx = await sendTransaction([playMessage(address, commit, betUgnot)], GAS.play, currentFee);
      const id = parsePlayId(tx.returned) ?? (await findOpenGameId(address, commit));
      if (!id) throw new Error("Mise envoyée, mais le numéro de partie est introuvable. Elle apparaîtra dans « Partie en cours ».");
      setSecretId(commit, id);

      const rolled = await waitForRoll(id);
      // Vérification indépendante : le dé doit correspondre à la graine publiée.
      if ((await rollFor(rolled.seed, rolled.commitment, rolled.id)) !== rolled.roll) {
        throw new Error("Le tirage publié ne correspond pas à sa graine. Partie signalée, ne rejoue pas avant vérification.");
      }

      const won = rolled.roll === chosen;
      const next: Outcome = { id, guess: chosen, bet, roll: rolled.roll, won, payout: won ? betUgnot * multiplier : 0 };
      outcomeRef.current = next;
      setOutcome(next);
      window.setTimeout(reveal, REVEAL_FALLBACK_MS);
      void settle(id, chosen, salt, commit);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
      busy.current = false;
      // On relit l'historique et le solde une fois le dé posé, pour ne pas dévoiler le résultat avant l'animation.
      const sync = () => {
        refresh();
        wallet.refreshBalance();
      };
      if (outcomeRef.current) window.setTimeout(sync, REVEAL_FALLBACK_MS);
      else sync();
    }
  }

  /** Attend le tirage : on le demande au croupier, sinon on surveille le contrat. */
  async function waitForRoll(id: number): Promise<Game> {
    try {
      const game = await requestResolve(id);
      if (game.status !== "pending") return game;
    } catch {
      // croupier injoignable : on surveille directement le contrat
    }
    for (let i = 0; i < 20; i++) {
      await wait(3_000);
      const game = await fetchGame(id).catch(() => null);
      if (game && game.status !== "pending") return game;
    }
    throw new Error(
      "Le croupier ne répond pas pour le moment. Ta mise est en sécurité : si le dé n'est pas tiré dans les 30 minutes, tu pourras la récupérer (« Partie en cours »).",
    );
  }

  /** Termine la partie : révélation relayée par le croupier, ou signée par le joueur en secours. */
  async function settle(id: number, chosen: number, salt: string, commit: string) {
    setSettlement("settling");
    try {
      const game = await requestReveal(id, chosen, salt);
      if (game.status === "won" || game.status === "lost") {
        forgetSecret(commit);
        setSettlement("done");
        refresh();
        wallet.refreshBalance();
        return;
      }
    } catch {
      // le croupier ne peut pas relayer : le joueur signera lui-même (bouton « Partie en cours »)
    }
    setSettlement("manual");
    refresh();
  }

  /** Retrouve le numéro de la partie à partir de son empreinte (si la réponse de la transaction est perdue). */
  async function findOpenGameId(address: string, commit: string): Promise<number | null> {
    for (let i = 0; i < 5; i++) {
      const fresh = await refresh();
      const match = fresh?.open.find((g) => g.commitment === commit && g.player === address);
      if (match) return match.id;
      await wait(1_500);
    }
    return null;
  }

  /** Clic sur « Lancer » : étincelles + vibration, puis le lancer. */
  function launch(e?: MouseEvent<HTMLElement>) {
    sparkBurstFrom(e?.currentTarget ?? playRef.current, { colors: RUBY, count: 18, spread: 110 });
    haptic(20);
    void play();
  }

  // --- Bouton principal : son texte et son action dépendent de la situation ---
  let action: PlayAction;
  if (status === "absent") action = { label: "Contrat pas encore déployé", disabled: true };
  else if (status === "inert") action = { label: "Activation du contrat…", disabled: true };
  else if (status === "loading") action = { label: "Chargement du jeu", disabled: true, busy: true };
  else if (!info) action = { label: "Réseau Gno injoignable", disabled: true };
  else if (wallet.status === "no-extension") action = { label: "Installer Adena pour jouer", href: ADENA_DOWNLOAD_URL };
  else if (wallet.status !== "connected")
    action = { label: "Connecter Adena pour jouer", onClick: wallet.connect, disabled: wallet.status === "connecting" || wallet.status === "checking" };
  else if (wallet.wrongNetwork) action = { label: `Passer sur ${config.chainName}`, onClick: wallet.switchNetwork };
  else if (pending) action = { label: "Le dé roule", disabled: true, busy: true };
  else if (info.paused) action = { label: "Jeu en pause", disabled: true };
  else if (cooldownLeft > 0) action = { label: `Prochain lancer dans ${formatCountdown(cooldownLeft)}`, disabled: true };
  else if (guess === null) action = { label: "Choisis d'abord un chiffre", disabled: true };
  else if (bet > maxCoverable)
    action = { label: maxCoverable >= minBet ? `Mise max possible : ${maxCoverable} GNOT` : "La banque est vide", disabled: true };
  else if (notEnoughFunds) action = { label: "Solde insuffisant", disabled: true };
  else action = { label: `Lancer pour ${bet} GNOT`, onClick: launch, primary: true };

  // --- Raccourcis clavier ---
  const keys = useRef({ action, pending, minBet, maxBet });
  useEffect(() => {
    keys.current = { action, pending, minBet, maxBet };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable='true'], [role='slider'], [role='menu']")) return;
      const k = keys.current;
      if (k.pending) return;
      if (/^[1-6]$/.test(e.key)) {
        setGuess(Number(e.key));
        haptic(8);
      } else if (e.key === "+" || e.key === "=") {
        setBet((b) => Math.min(k.maxBet, b + 1));
      } else if (e.key === "-" || e.key === "_") {
        setBet((b) => Math.max(k.minBet, b - 1));
      } else if (e.key === "Enter" && (el === document.body || !el) && k.action.primary) {
        e.preventDefault();
        k.action.onClick?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Texte sous le dé ---
  let caption: ReactNode;
  if (pending) {
    caption = (
      <motion.p key="pending" {...fade} className="max-w-sm text-[0.95rem] text-haze">
        Signe dans Adena. Le dé tourne tant que la blockchain n&apos;a pas répondu.
      </motion.p>
    );
  } else if (outcome && !revealed) {
    caption = <motion.p key="landing" {...fade} className="h-6" />;
  } else if (outcome?.won) {
    caption = (
      <motion.div key="win" {...fade} className="flex flex-col items-center">
        <p className="display-soft text-[clamp(2.4rem,5vw,3.5rem)] leading-none text-chalk">
          +<AnimatedNumber value={outcome.payout} from={0} speed="slow" format={(n) => formatGnot(n)} /> GNOT
        </p>
        <p className="mt-2 text-[0.95rem] text-haze">
          Le dé est tombé sur ton {outcome.roll}.{" "}
          {settlement === "done" ? "Gain versé sur ton wallet." : settlement === "manual" ? "Encaisse ton gain ci-dessous." : "Versement en cours…"}
        </p>
      </motion.div>
    );
  } else if (outcome) {
    caption = (
      <motion.div key="lose" {...fade} className="flex flex-col items-center">
        <p className="display-soft text-[clamp(2rem,4vw,2.75rem)] leading-none text-chalk/80">Tombé sur le {outcome.roll}.</p>
        <p className="mt-2 text-[0.95rem] text-haze">Tu avais choisi le {outcome.guess}. Prochain lancer dans 10 minutes.</p>
      </motion.div>
    );
  } else {
    caption = (
      <motion.p key="idle" {...fade} className="max-w-xs text-[0.95rem] text-haze">
        <span className="hidden [@media(hover:hover)]:inline">Attrape le dé et lance-le pour un essai. Rien n&apos;est misé.</span>
        <span className="[@media(hover:hover)]:hidden">Fais glisser le dé pour un essai. Rien n&apos;est misé.</span>
      </motion.p>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="table-title"
      className="relative grid items-center gap-x-12 gap-y-10 pb-16 pt-8 [grid-template-areas:'head'_'stage'_'ctrl'] sm:pt-10 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-y-14 lg:[grid-template-areas:'head_stage'_'ctrl_stage']"
    >
      {/* Titre */}
      <div className="[grid-area:head] lg:self-end">
        <motion.h1
          id="table-title"
          style={{ fontVariationSettings }}
          className="font-display text-[clamp(3rem,7vw,6.25rem)] leading-[0.92] tracking-[-0.035em] text-chalk"
        >
          {TITLE.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.08em]">
              <motion.span
                className="block"
                initial={{ y: "105%" }}
                animate={introDone ? { y: "0%" } : undefined}
                transition={{ duration: 1.2, ease: EASE, delay: 0.1 + i * 0.09 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={introDone ? { opacity: 1 } : undefined}
          transition={{ duration: 1, delay: 0.55 }}
          className="mt-6 max-w-[46ch] text-[1.05rem] leading-relaxed text-haze sm:text-lg"
        >
          Choisis un chiffre, mise de {GAME.minBetGnot} à {GAME.maxBetGnot} GNOT et lance. Si le dé tombe sur ton chiffre, tu repars avec{" "}
          {multiplier} fois ta mise. Tout se joue sur Gno.land, à la vue de tous.
        </motion.p>
      </div>

      {/* Le dé */}
      <motion.div
        className="[grid-area:stage] lg:self-center"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={introDone ? { opacity: 1, scale: 1 } : undefined}
        transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
      >
        <motion.div animate={shake}>
          <DieStage
            face={outcome && !pending ? outcome.roll : (guess ?? 5)}
            rolling={pending}
            outcome={outcome}
            fx={sceneFx}
            allowToy={!pending && !(outcome && !revealed)}
            onImpact={impact}
            onLanded={reveal}
            caption={<AnimatePresence mode="wait">{caption}</AnimatePresence>}
          />
        </motion.div>
      </motion.div>

      {/* Commandes */}
      <motion.div
        className="flex flex-col gap-9 [grid-area:ctrl] lg:self-start"
        initial={{ opacity: 0, y: 16 }}
        animate={introDone ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 1, ease: EASE, delay: 0.7 }}
      >
        <div className="flex flex-col gap-3">
          <ControlLabel hint="1 à 6">Ton chiffre</ControlLabel>
          <NumberPicker value={guess} onChange={setGuess} disabled={pending} />
        </div>

        <div className="flex flex-col gap-3">
          <ControlLabel hint="+ −">Ta mise</ControlLabel>
          <BetControl value={bet} min={minBet} max={maxBet} onChange={setBet} disabled={pending} />
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-haze">
            Gain si tu tombes juste
            <strong className="display-soft text-2xl font-normal text-chalk">
              <AnimatedNumber value={bet * multiplier} /> GNOT
            </strong>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex items-center gap-1 text-xs text-haze underline-offset-2 hover:text-chalk hover:underline">
                  <Info className="size-3.5" /> frais
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Frais réseau ≈ {formatGnot(fee, 3)} GNOT
                {firstGame ? " (+ ~0,85 GNOT de dépôt de stockage à ta 1re partie)" : " (+ un petit dépôt de stockage)"}
              </TooltipContent>
            </Tooltip>
          </p>
        </div>

        <div ref={playRef}>
          <PlayButton action={action} />
        </div>

        {cooldownLeft > 0 && (
          <div className="flex flex-col gap-2" aria-live="polite">
            <Progress value={Math.round(cooldownProgress * 100)} aria-label="Temps avant le prochain lancer" />
            <p className="flex items-center gap-2 text-sm text-haze">
              <Timer className="size-4 text-signal" />
              Un lancer toutes les 10 minutes. Reviens dans <strong className="tabular-nums text-chalk">{formatCountdown(cooldownLeft)}</strong>
            </p>
          </div>
        )}

        {player && player.open.length > 0 && (
          <OpenGames games={player.open} onChange={() => (refresh(), wallet.refreshBalance())} highlightManual={settlement === "manual"} />
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
      </motion.div>

      <ScreenFlash flash={flash} />
    </section>
  );
}

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: EASE },
};

/** Libellé d'une commande, avec son raccourci clavier (ordinateur seulement). */
function ControlLabel({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <p className="flex items-center justify-between text-[0.95rem] font-medium text-chalk">
      {children}
      <kbd className="hidden rounded-md border border-border bg-lapis-800 px-1.5 py-0.5 font-sans text-[0.7rem] text-haze [@media(hover:hover)]:inline-block">
        {hint}
      </kbd>
    </p>
  );
}
