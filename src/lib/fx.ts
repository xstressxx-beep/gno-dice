"use client";

// Petits effets visuels déclenchés par les actions du joueur (GSAP).
// Tout est dessiné sur un calque fixe au-dessus de la page, créé à la demande,
// et chaque particule se supprime toute seule à la fin de son animation.
// - sparkBurst : gerbe d'étincelles à un point de l'écran (clic, choix d'un chiffre…)
// - sparkBurstFrom : idem, depuis le centre d'un élément
// - haptic : vibration du téléphone (si l'appareil le permet)

import gsap from "gsap";

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

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type BurstOptions = {
  /** Nombre d'étincelles. */
  count?: number;
  /** Palette (or par défaut). */
  colors?: string[];
  /** Vitesse de projection (px). */
  spread?: number;
  /** Ajoute un anneau lumineux qui s'élargit. */
  ring?: boolean;
};

const GOLD = ["#fff7d6", "#fde7a1", "#f5c542", "#e0aa24"];
export const RED = ["#ffd1d6", "#ff6b7a", "#ef3346", "#c8102e"];

/** Gerbe d'étincelles au point (x, y) de l'écran. */
export function sparkBurst(x: number, y: number, { count = 14, colors = GOLD, spread = 70, ring = true }: BurstOptions = {}) {
  const root = getLayer();
  if (!root || prefersReducedMotion()) return;
  const r = gsap.utils.random;

  if (ring) {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      border: `2px solid ${colors[1]}`,
      boxShadow: `0 0 14px ${colors[2]}`,
      transform: "translate(-50%, -50%)",
    });
    root.appendChild(el);
    gsap.fromTo(el, { scale: 0.3, opacity: 0.9 }, { scale: 4, opacity: 0, duration: 0.6, ease: "expo.out", onComplete: () => el.remove() });
  }

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const size = r(2, 5);
    const color = colors[i % colors.length];
    Object.assign(el.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 8px 1px ${color}`,
    });
    root.appendChild(el);
    const angle = (i / count) * Math.PI * 2 + r(-0.3, 0.3);
    const dist = r(spread * 0.45, spread);
    gsap.fromTo(
      el,
      { x: 0, y: 0, scale: 1, opacity: 1 },
      {
        x: Math.cos(angle) * dist,
        // légère gravité : les étincelles retombent un peu
        y: Math.sin(angle) * dist + r(10, 30),
        scale: 0,
        opacity: 0,
        duration: r(0.5, 0.9),
        ease: "power3.out",
        onComplete: () => el.remove(),
      },
    );
  }
}

/** Gerbe d'étincelles depuis le centre d'un élément. */
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
