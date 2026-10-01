"use client";

// Transition entre les pages (Framer Motion). Next.js recrée ce « template » à
// chaque changement de page : un panneau lapis, bordé d'un filet rubis, se
// retire vers le haut comme on lève le couvercle d'une table, et le contenu
// remonte en douceur.

import type { ReactNode } from "react";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[80] origin-top bg-lapis-950"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.85, ease: EASE }}
      >
        <div className="absolute inset-x-0 bottom-0 h-px bg-ruby" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, transitionEnd: { transform: "none" } }}
        transition={{ duration: 1, ease: EASE, delay: 0.15 }}
      >
        {children}
      </motion.div>
    </>
  );
}
