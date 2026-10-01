"use client";

// Transition entre les pages (Framer Motion). Next.js recrée ce « template » à
// chaque changement de page : le contenu apparaît en glissant, pendant
// qu'un voile doré balaie l'écran de bas en haut.

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/components/Reveal";

export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[80] origin-top bg-gradient-to-b from-[#0b0803] via-[#040404] to-[#040404]"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
      >
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-300 to-transparent" />
      </motion.div>
      <motion.div
        // Pas de flou ici : flouter toute la page coûte très cher au navigateur.
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, transitionEnd: { transform: "none" } }}
        transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.15 }}
      >
        {children}
      </motion.div>
    </>
  );
}
