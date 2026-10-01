"use client";

// Le bouton « Lancer », couleur acétate rubis (comme le dé).
// Prêt : un reflet le traverse, il s'enfonce au clic et il est légèrement
// attiré par la souris (data-magnetic, voir CustomCursor).
// En attente : trois points rebondissent. Indisponible : il reste calme et dit pourquoi.

import type { MouseEvent } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type PlayAction = {
  label: string;
  onClick?: (e?: MouseEvent<HTMLElement>) => void;
  href?: string;
  disabled?: boolean;
  /** Animation d'attente (lancer en cours). */
  busy?: boolean;
  /** L'action principale du jeu (lancer le dé) : bouton rubis. */
  primary?: boolean;
};

/** Trois points qui rebondissent l'un après l'autre (remplace la roue de chargement). */
export function BouncingPips({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-end gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-current"
          animate={{ y: [0, -6, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export function PlayButton({ action }: { action: PlayAction }) {
  const t = useTranslations("play");
  const ready = !action.disabled && (!!action.onClick || !!action.href);
  const hot = ready && action.primary;

  const className = cn(
    "group relative flex min-h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-full px-6 py-4 text-lg font-semibold no-underline transition-colors duration-300 hover:no-underline disabled:cursor-not-allowed",
    hot && "bg-ruby text-white shadow-casino hover:bg-[#f0234b] hover:text-white",
    ready && !hot && "bg-chalk text-lapis hover:bg-white hover:text-lapis",
    !ready && "border border-border bg-lapis-800/60 text-haze",
  );

  const content = (
    <>
      {hot && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-sweep bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      )}
      {action.busy && <BouncingPips className={ready ? "" : "text-chalk"} />}
      <span className="relative text-center leading-tight">{action.label}</span>
      {hot && (
        <kbd aria-hidden className="relative hidden rounded-md border border-white/30 px-1.5 py-0.5 font-sans text-[0.7rem] font-medium text-white/80 [@media(hover:hover)]:inline-block">
          {t("enter")}
        </kbd>
      )}
    </>
  );

  const motionProps = {
    whileHover: ready ? { scale: 1.015 } : undefined,
    whileTap: ready ? { scale: 0.96 } : undefined,
    transition: { type: "spring" as const, stiffness: 500, damping: 26 },
  };

  return (
    // L'aimant agit sur ce conteneur (le bouton garde ses propres animations).
    <div className="relative" data-magnetic={ready ? "0.1" : undefined} data-cursor-label={hot ? t("cursor") : undefined}>
      {hot && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-ruby/40" />}
      {action.href ? (
        <motion.a href={action.href} target="_blank" rel="noreferrer" className={className} {...motionProps}>
          {content}
        </motion.a>
      ) : (
        <motion.button type="button" onClick={action.onClick} disabled={action.disabled} aria-busy={action.busy} className={className} {...motionProps}>
          {content}
        </motion.button>
      )}
    </div>
  );
}
