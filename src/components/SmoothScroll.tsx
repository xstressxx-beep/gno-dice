"use client";

// Défilement fluide (Lenis) : la molette glisse au lieu de sauter par crans.
// Désactivé si l'utilisateur préfère moins d'animations, et sur écran tactile
// (le défilement natif du téléphone est déjà fluide).

import { useEffect } from "react";
import Lenis from "lenis";
import { isReducedMotion } from "@/lib/motion";

export function SmoothScroll() {
  useEffect(() => {
    const reduce = isReducedMotion();
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || touch) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.11, wheelMultiplier: 0.9 });
    return () => lenis.destroy();
  }, []);
  return null;
}
