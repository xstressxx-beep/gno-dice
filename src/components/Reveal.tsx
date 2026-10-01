"use client";

// Révélation progressive au défilement (Framer Motion) : l'élément monte
// doucement et apparaît quand il entre dans l'écran (une seule fois).
// Pas de flou : il coûte cher au navigateur et « aplatirait » la 3D du dé.

import type { ReactNode } from "react";
import { motion } from "framer-motion";

// Courbe « expo out » : départ rapide, arrivée très douce (style Apple).
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Retard en secondes (pour enchaîner plusieurs éléments). */
  delay?: number;
  /** Distance de montée en px. */
  y?: number;
  as?: "div" | "section" | "li";
  id?: string;
};

export function Reveal({ children, className, delay = 0, y = 36, as = "div", id }: RevealProps) {
  const Comp = motion[as];
  return (
    <Comp
      id={id}
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 1.1, ease: EASE_OUT_EXPO, delay }}
    >
      {children}
    </Comp>
  );
}
