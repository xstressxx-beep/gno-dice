"use client";

// Préférence d'animation du site, une seule source de vérité pour tous les effets
// (Framer Motion, GSAP, React Spring, Lenis, CSS).
// - par défaut : on suit le réglage de l'appareil (« réduire les animations »)
// - le joueur peut choisir lui-même avec le bouton de l'en-tête ; son choix est retenu
// La classe `reduce-motion` sur <html> est posée avant l'affichage par un petit
// script dans layout.tsx (voir MOTION_SCRIPT), puis tenue à jour ici.

import { useSyncExternalStore } from "react";

export const MOTION_KEY = "gd-motion";
const EVENT = "gnodice:motion";

/** Script exécuté dans <head> avant l'affichage : pose la bonne classe tout de suite. */
export const MOTION_SCRIPT = `try{var m=localStorage.getItem("${MOTION_KEY}");var r=m?m==="reduced":matchMedia("(prefers-reduced-motion: reduce)").matches;if(r)document.documentElement.classList.add("reduce-motion")}catch(e){}`;

/** true si les animations doivent être réduites. */
export function isReducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("reduce-motion");
}

/** true si l'appareil demande moins d'animations (réglage système). */
export function systemPrefersReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Change la préférence et prévient tout le site. */
export function setReducedMotion(reduced: boolean) {
  document.documentElement.classList.toggle("reduce-motion", reduced);
  try {
    localStorage.setItem(MOTION_KEY, reduced ? "reduced" : "full");
  } catch {
    // stockage indisponible : le choix vaut pour cette page seulement
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Hook React : la préférence actuelle, mise à jour quand le joueur la change. */
export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(subscribe, isReducedMotion, () => false);
}
