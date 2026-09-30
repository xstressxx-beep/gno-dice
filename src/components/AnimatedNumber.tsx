"use client";

// Nombre qui « glisse » vers sa nouvelle valeur avec un ressort (React Spring).
// Utilisé pour les soldes, les gains et les statistiques : quand la valeur
// change, les chiffres défilent au lieu de sauter d'un coup.

import { animated, useSpring } from "@react-spring/web";

type AnimatedNumberProps = {
  value: number;
  /** Transforme le nombre en texte (ex. ugnot -> "12,5"). */
  format?: (n: number) => string;
  /** Valeur de départ au premier affichage (par défaut : la valeur elle-même, sans animation). */
  from?: number;
  /** Durée approximative : "fast" pour les petits changements, "slow" pour un gain. */
  speed?: "fast" | "slow";
  className?: string;
};

const CONFIGS = {
  // clamp : pas de dépassement, un montant ne doit jamais s'afficher plus haut que la vraie valeur
  fast: { tension: 260, friction: 30, clamp: true },
  // amortissement « critique » : arrive le plus vite possible sans dépasser (≈ 1,5 s)
  slow: { tension: 45, friction: 13.5, clamp: true },
};

const defaultFormat = (n: number) => Math.round(n).toLocaleString("fr-FR");

export function AnimatedNumber({ value, format = defaultFormat, from, speed = "fast", className }: AnimatedNumberProps) {
  const { n } = useSpring({ from: { n: from ?? value }, to: { n: value }, config: CONFIGS[speed] });
  return <animated.span className={className}>{n.to(format)}</animated.span>;
}
