"use client";

// Dit si l'intro (Preloader) est terminée, pour lancer l'animation d'arrivée
// de la page au bon moment. Vrai tout de suite si l'intro a déjà été vue
// pendant cette visite ou si l'utilisateur préfère moins d'animations.

import { useSyncExternalStore } from "react";

export const INTRO_EVENT = "gnodice:intro-done";

function isDone(): boolean {
  const html = document.documentElement;
  return (
    html.classList.contains("intro-seen") ||
    html.classList.contains("intro-done") ||
    html.classList.contains("reduce-motion")
  );
}

function subscribe(onChange: () => void) {
  window.addEventListener(INTRO_EVENT, onChange);
  return () => window.removeEventListener(INTRO_EVENT, onChange);
}

export function useIntroDone(): boolean {
  return useSyncExternalStore(subscribe, isDone, () => false);
}

/** Appelé par le Preloader à la fin de l'intro. */
export function markIntroDone() {
  document.documentElement.classList.add("intro-done");
  window.dispatchEvent(new Event(INTRO_EVENT));
}
