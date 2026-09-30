"use client";

// Le gros bouton rouge JOUER. Quand on peut jouer, il « respire » (Framer
// Motion), une onde rouge s'en échappe et un reflet passe dessus.
// Quand on ne peut pas jouer, il reste rouge mais immobile et explique pourquoi.

import { motion } from "framer-motion";
import { Dices, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlayAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Affiche une roue qui tourne (lancer en cours). */
  busy?: boolean;
};

const GLOW_SOFT = "0 0 18px rgba(220,20,45,0.45), 0 0 0 1px rgba(253,231,161,0.35)";
const GLOW_STRONG = "0 0 42px rgba(255,40,70,0.85), 0 0 0 1px rgba(253,231,161,0.7)";

export function PlayButton({ action }: { action: PlayAction }) {
  const ready = !action.disabled && (!!action.onClick || !!action.href);
  // Sur mobile le texte peut passer sur deux lignes plutôt que d'être coupé.
  const className = cn(
    buttonVariants({ variant: "casino", size: "xl" }),
    "h-auto min-h-[3.75rem] w-full overflow-hidden whitespace-normal px-4 py-3 text-base leading-tight sm:min-h-16 sm:px-8 sm:text-xl",
  );

  const content = (
    <>
      {ready && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-sweep bg-gradient-to-r from-transparent via-white/45 to-transparent"
        />
      )}
      {action.busy ? <Loader2 className="!size-5 animate-spin" /> : <Dices className="!size-5 sm:!size-6" />}
      <span className="relative text-center">{action.label}</span>
    </>
  );

  const motionProps = {
    animate: ready ? { scale: [1, 1.025, 1], boxShadow: [GLOW_SOFT, GLOW_STRONG, GLOW_SOFT] } : { scale: 1, boxShadow: GLOW_SOFT },
    transition: ready ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" as const } : { duration: 0.3 },
    whileTap: ready ? { scale: 0.96 } : undefined,
  };

  return (
    <div className="relative">
      {/* Onde rouge qui s'échappe du bouton */}
      {ready && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-casino/50" />}
      {action.href ? (
        <motion.a href={action.href} target="_blank" rel="noreferrer" className={className} {...motionProps}>
          {content}
        </motion.a>
      ) : (
        <motion.button type="button" onClick={action.onClick} disabled={action.disabled} className={className} {...motionProps}>
          {content}
        </motion.button>
      )}
    </div>
  );
}
