"use client";

// Petits effets visuels déclenchés par les actions du joueur (GSAP).
// Tout est dessiné sur un calque fixe au-dessus de la page, créé à la demande,
// et chaque particule se supprime toute seule à la fin de son animation.
// - sparkBurst : gerbe d'éclats à un point de l'écran (clic, choix d'un chiffre…)
// - sparkBurstFrom : idem, depuis le centre d'un élément
// - haptic : vibration du téléphone (si l'appareil le permet)

import gsap from "gsap";
import { isReducedMotion } from "./motion";

let layer: HTMLDivElement | null = null;

/** Le calque des effets, ajouté à <body> une seule fois. */
function getLayer(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "70", overflow: "hidden" });
  document.body.appendChild(layer);
  return layer;
}

/** true si les animations sont réduites (réglage de l'appareil ou choix du joueur). */
export const prefersReducedMotion = isReducedMotion;

type BurstOptions = {
  /** Nombre d'éclats. */
  count?: number;
  /** Palette (craie et pervenche par défaut). */
  colors?: string[];
  /** Distance de projection (px). */
  spread?: number;
  /** Ajoute un anneau qui s'élargit. */
  ring?: boolean;
};

const CHALK = ["#FBF9F4", "#EFEADF", "#9DB0FF", "#3A54E6"];
export const RUBY = ["#FFD6DE", "#FF5470", "#E3173E", "#FBF9F4"];

/** Gerbe d'éclats au point (x, y) de l'écran : de petits traits qui filent, pas des points. */
export function sparkBurst(x: number, y: number, { count = 12, colors = CHALK, spread = 60, ring = true }: BurstOptions = {}) {
  const root = getLayer();
  if (!root || prefersReducedMotion()) return;
  const r = gsap.utils.random;

  if (ring) {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      border: `1.5px solid ${colors[1]}`,
      transform: "translate(-50%, -50%)",
    });
    root.appendChild(el);
    gsap.fromTo(el, { scale: 0.3, opacity: 0.9 }, { scale: 4.5, opacity: 0, duration: 0.65, ease: "expo.out", onComplete: () => el.remove() });
  }

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const angle = (i / count) * 360 + r(-12, 12);
    const color = colors[i % colors.length];
    Object.assign(el.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${r(8, 14)}px`,
      height: "2px",
      borderRadius: "2px",
      background: color,
      transformOrigin: "0 50%",
    });
    root.appendChild(el);
    const dist = r(spread * 0.5, spread);
    const rad = (angle * Math.PI) / 180;
    gsap.fromTo(
      el,
      { x: 0, y: 0, rotation: angle, scaleX: 1, opacity: 1 },
      {
        x: Math.cos(rad) * dist,
        y: Math.sin(rad) * dist,
        scaleX: 0,
        opacity: 0,
        duration: r(0.45, 0.75),
        ease: "power3.out",
        onComplete: () => el.remove(),
      },
    );
  }
}

/** Gerbe d'éclats depuis le centre d'un élément. */
export function sparkBurstFrom(el: Element | null | undefined, options?: BurstOptions) {
  if (!el) return;
  const box = el.getBoundingClientRect();
  sparkBurst(box.left + box.width / 2, box.top + box.height / 2, options);
}

/** Vibration courte (mobile Android ; ignoré ailleurs). */
export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator && !prefersReducedMotion()) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // certains navigateurs refusent sans geste de l'utilisateur : on ignore
    }
  }
}
