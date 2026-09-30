"use client";

// La scène du dé : tapis de velours, projecteur doré, dé 3D (Framer Motion),
// compteurs qui défilent (React Spring) et message du résultat.

import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { animated, useSpring } from "@react-spring/web";
import { formatGnot } from "@/lib/format";
import { AnimatedNumber } from "./AnimatedNumber";
import { Dice3D } from "./Dice3D";
import { NumberReel } from "./NumberReel";

export type Outcome = { guess: number; bet: number; roll: number; won: boolean; payout: number };

type DiceStageProps = {
  /** true pendant la transaction : le dé roule. */
  pending: boolean;
  /** Résultat du dernier lancer. */
  outcome: Outcome | null;
  /** true quand le dé s'est posé : on peut afficher gagné / perdu. */
  revealed: boolean;
  guess: number | null;
  multiplier: number;
  onLanded: () => void;
  /** Référence vers le dé (point de départ de l'explosion dorée). */
  dieRef: RefObject<HTMLDivElement | null>;
};

export function DiceStage({ pending, outcome, revealed, guess, multiplier, onLanded, dieRef }: DiceStageProps) {
  const won = revealed && !!outcome?.won;
  const dieFace = outcome?.roll ?? guess ?? 5;

  let message;
  if (pending) {
    message = (
      <motion.p key="pending" {...fade} className="max-w-sm text-sm text-gold-100 sm:text-base">
        <motion.span animate={{ opacity: [1, 0.45, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
          Confirme dans Adena… puis le dé roule sur la blockchain.
        </motion.span>
      </motion.p>
    );
  } else if (outcome && !revealed) {
    message = (
      <motion.p key="landing" {...fade} className="font-display text-lg tracking-[0.2em] text-primary">
        Le dé ralentit…
      </motion.p>
    );
  } else if (outcome && outcome.won) {
    message = <WinBanner key="win" payout={outcome.payout} roll={outcome.roll} />;
  } else if (outcome) {
    message = (
      <motion.div
        key="lose"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }}
        exit={{ opacity: 0 }}
        transition={{ x: { duration: 0.5, delay: 0.15 } }}
        className="flex flex-col items-center gap-1"
      >
        <p className="font-display text-2xl font-extrabold tracking-[0.14em] text-destructive sm:text-3xl">Perdu…</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Le dé est tombé sur <strong className="text-foreground">{outcome.roll}</strong>, tu avais choisi{" "}
          <strong className="text-foreground">{outcome.guess}</strong>. Retente ta chance dans 10 minutes !
        </p>
      </motion.div>
    );
  } else {
    message = (
      <motion.p key="idle" {...fade} className="max-w-md text-sm text-muted-foreground sm:text-base">
        Choisis un chiffre, fixe ta mise et appuie sur <strong className="text-casino-foreground">JOUER</strong>. Si le dé tombe sur ton
        chiffre, tu gagnes <strong className="text-primary">{multiplier}× ta mise</strong>.
      </motion.p>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-t-lg border-b border-primary/15">
      {/* Tapis : velours rouge très sombre éclairé par un projecteur doré */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_0%,rgba(245,197,66,0.2),transparent_70%),radial-gradient(ellipse_110%_90%_at_50%_115%,rgba(150,12,34,0.5),transparent_70%)]"
      />
      {/* Motif losange discret */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(45deg,#f5c542_0_1px,transparent_1px_16px),repeating-linear-gradient(-45deg,#f5c542_0_1px,transparent_1px_16px)]"
      />
      {/* Lumière dorée quand on gagne */}
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(245,197,66,0.3),transparent_62%)]"
        initial={false}
        animate={{ opacity: won ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      />

      <div className="relative flex flex-col items-center px-4 pb-5 pt-7 sm:pt-9">
        <div ref={dieRef}>
          <Dice3D value={dieFace} rolling={pending} gold={won} onLanded={onLanded} className="[--die:86px] sm:[--die:116px]" />
        </div>

        <div className="-mt-3 flex items-end gap-4 sm:gap-7">
          <NumberReel caption="Ton chiffre" spinning={false} value={outcome?.guess ?? guess} cell={50} />
          <span aria-hidden className="pb-3.5 font-display text-lg text-primary/45">vs</span>
          <NumberReel caption="Résultat" spinning={pending} value={pending ? null : (outcome?.roll ?? null)} highlight={won} cell={50} />
        </div>

        <div className="mt-4 flex min-h-[6.75rem] w-full items-center justify-center text-center" aria-live="polite">
          <AnimatePresence mode="wait">{message}</AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3 },
};

/**
 * Bannière de victoire : elle « saute » avec un ressort très souple (React Spring)
 * et le gain défile de 0 jusqu'au montant gagné.
 */
function WinBanner({ payout, roll }: { payout: number; roll: number }) {
  const pop = useSpring({
    from: { scale: 0.2, opacity: 0, rotate: -12 },
    to: { scale: 1, opacity: 1, rotate: 0 },
    config: { tension: 320, friction: 9 },
  });

  return (
    <motion.div exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}>
      <animated.div style={pop} className="flex flex-col items-center gap-0.5">
        <p className="gold-text-animated font-display text-3xl font-extrabold tracking-[0.16em] drop-shadow-[0_0_18px_rgba(245,197,66,0.55)] sm:text-4xl">
          GAGNÉ !
        </p>
        <p className="font-display text-2xl font-bold text-gold-100 sm:text-3xl">
          +<AnimatedNumber value={payout} from={0} speed="slow" format={(n) => formatGnot(n)} className="tabular-nums" /> GNOT
        </p>
        <p className="text-sm text-muted-foreground">
          Le dé est tombé sur <strong className="text-foreground">{roll}</strong> 🎉
        </p>
      </animated.div>
    </motion.div>
  );
}
