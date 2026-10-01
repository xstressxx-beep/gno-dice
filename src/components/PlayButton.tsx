"use client";

// Le gros bouton rouge JOUER. Quand on peut jouer, il « respire » (Framer
// Motion), une onde rouge s'en échappe, un reflet passe dessus et il est
// légèrement attiré par la souris (data-magnetic, voir CustomCursor).
// Pendant un lancer, trois points dorés rebondissent à la place de l'icône.
// Quand on ne peut pas jouer, il reste rouge mais immobile et explique pourquoi.

import type { MouseEvent } from "react";
import { motion } from "framer-motion";
import { Dices } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlayAction = {
  label: string;
  onClick?: (e?: MouseEvent<HTMLElement>) => void;
  href?: string;
  disabled?: boolean;
  /** Animation d'attente (lancer en cours). */
  busy?: boolean;
};

const GLOW_SOFT = "0 0 18px rgba(220,20,45,0.45), 0 0 0 1px rgba(253,231,161,0.35)";
const GLOW_STRONG = "0 0 42px rgba(255,40,70,0.85), 0 0 0 1px rgba(253,231,161,0.7)";

/** Trois points qui rebondissent l'un après l'autre (remplace la roue de chargement). */
export function BouncingPips({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-end gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-current"
          animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

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
      {action.busy ? <BouncingPips className="text-gold-200" /> : <Dices className="!size-5 transition-transform duration-500 group-hover:rotate-[20deg] sm:!size-6" />}
      <span className="relative text-center">{action.label}</span>
    </>
  );

  const motionProps = {
    animate: ready ? { scale: [1, 1.025, 1], boxShadow: [GLOW_SOFT, GLOW_STRONG, GLOW_SOFT] } : { scale: 1, boxShadow: GLOW_SOFT },
    transition: ready ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" as const } : { duration: 0.3 },
    whileHover: ready ? { scale: 1.02 } : undefined,
    whileTap: ready ? { scale: 0.95 } : undefined,
  };

  return (
    // L'aimant agit sur ce conteneur (le bouton garde ses propres animations).
    <div className="relative" data-magnetic={ready ? "0.12" : undefined}>
      {/* Onde rouge qui s'échappe du bouton */}
      {ready && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-casino/50" />}
      {action.href ? (
        <motion.a href={action.href} target="_blank" rel="noreferrer" className={cn(className, "group")} {...motionProps}>
          {content}
        </motion.a>
      ) : (
        <motion.button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          aria-busy={action.busy}
          className={cn(className, "group")}
          {...motionProps}
        >
          {content}
        </motion.button>
      )}
    </div>
  );
}
