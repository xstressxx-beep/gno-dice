"use client";

// Explosion de particules dorées quand le joueur gagne, animée avec GSAP.
// À chaque victoire (`burst` augmente de 1) on crée, par-dessus toute la page :
// - un flash de lumière et une onde de choc dorée
// - des rayons de lumière qui tournent (effet « jackpot »)
// - des pièces, paillettes, étoiles et confettis projetés vers le haut puis
//   retombant avec la gravité (plugin Physics2D de GSAP)
// Tout est supprimé automatiquement à la fin.

import { useRef, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, Physics2DPlugin);

type WinExplosionProps = {
  /** Compteur de victoires : chaque nouvelle valeur (> 0) déclenche une explosion. */
  burst: number;
  /** Élément d'où part l'explosion (le dé). */
  originRef: RefObject<HTMLElement | null>;
};

type Kind = "coin" | "dust" | "star" | "confetti";

const KINDS: Kind[] = ["coin", "coin", "dust", "dust", "dust", "star", "confetti", "confetti"];
const CONFETTI_COLORS = ["#f5c542", "#fde7a1", "#fff7d6", "#e0aa24", "#dc1433"];
const STAR = "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)";

/** Crée une particule (un simple <div>) avec son apparence. */
function createParticle(kind: Kind): HTMLDivElement {
  const el = document.createElement("div");
  const r = gsap.utils.random;
  const s = el.style;
  s.position = "absolute";
  s.left = "0";
  s.top = "0";
  s.willChange = "transform, opacity";
  if (kind === "coin") {
    const size = r(14, 24, 1);
    s.width = s.height = `${size}px`;
    s.borderRadius = "50%";
    s.background = "radial-gradient(circle at 35% 30%, #fff6cf 0%, #f5c542 45%, #a8760a 100%)";
    s.border = "1px solid #8a6408";
    s.boxShadow = "0 0 10px rgba(245,197,66,0.8)";
  } else if (kind === "dust") {
    const size = r(3, 8, 1);
    s.width = s.height = `${size}px`;
    s.borderRadius = "50%";
    s.background = "#fff3c4";
    s.boxShadow = "0 0 8px 2px rgba(245,197,66,0.9)";
  } else if (kind === "star") {
    const size = r(10, 20, 1);
    s.width = s.height = `${size}px`;
    s.background = "linear-gradient(135deg, #fffaeb, #f5c542)";
    s.clipPath = STAR;
  } else {
    s.width = `${r(6, 9, 1)}px`;
    s.height = `${r(11, 16, 1)}px`;
    s.borderRadius = "2px";
    s.background = CONFETTI_COLORS[r(0, CONFETTI_COLORS.length - 1, 1)];
  }
  return el;
}

/** Crée un calque centré (flash, onde, rayons). */
function createGlow(size: number, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, { position: "absolute", left: "0", top: "0", width: `${size}px`, height: `${size}px`, borderRadius: "50%" }, style);
  return el;
}

// Le portail vers <body> n'existe que dans le navigateur (pas pendant le rendu serveur).
const subscribe = () => () => {};

export function WinExplosion({ burst, originRef }: WinExplosionProps) {
  const layer = useRef<HTMLDivElement>(null);
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  useGSAP(
    () => {
      const root = layer.current;
      if (burst <= 0 || !root) return;

      // Point de départ : le centre du dé à l'écran.
      const box = originRef.current?.getBoundingClientRect();
      const cx = box ? box.left + box.width / 2 : window.innerWidth / 2;
      const cy = box ? box.top + box.height * 0.42 : window.innerHeight / 2;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mobile = window.innerWidth < 640;
      const r = gsap.utils.random;

      const created: HTMLElement[] = [];
      const add = <T extends HTMLElement>(el: T): T => {
        root.appendChild(el);
        created.push(el);
        gsap.set(el, { x: cx, y: cy, xPercent: -50, yPercent: -50 });
        return el;
      };

      // 1) Flash de lumière
      const flash = add(
        createGlow(mobile ? 360 : 560, {
          background: "radial-gradient(circle, rgba(255,250,230,0.95) 0%, rgba(245,197,66,0.55) 25%, rgba(245,197,66,0) 65%)",
        }),
      );
      gsap.fromTo(flash, { scale: 0.1, opacity: 1 }, { scale: 1.5, opacity: 0, duration: reduceMotion ? 0.6 : 1.1, ease: "expo.out" });

      if (reduceMotion) return () => created.forEach((el) => el.remove());

      // 2) Onde de choc
      const ring = add(createGlow(140, { border: "3px solid rgba(253,231,161,0.9)", boxShadow: "0 0 30px rgba(245,197,66,0.7)" }));
      gsap.fromTo(ring, { scale: 0.2, opacity: 1 }, { scale: mobile ? 4 : 6, opacity: 0, duration: 1.3, ease: "power3.out" });

      // 3) Rayons de lumière qui tournent
      const raysSize = mobile ? 620 : 980;
      const rays = add(
        createGlow(raysSize, {
          background: "repeating-conic-gradient(from 0deg, rgba(245,197,66,0.28) 0deg 5deg, rgba(245,197,66,0) 5deg 15deg)",
          maskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 30%, transparent 68%)",
          webkitMaskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 30%, transparent 68%)",
        }),
      );
      gsap
        .timeline()
        .fromTo(rays, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.55, ease: "power2.out" })
        .to(rays, { rotation: 75, duration: 3, ease: "none" }, 0)
        .to(rays, { opacity: 0, duration: 1 }, 2);

      // 4) Particules : projetées vers le haut, puis la gravité les fait retomber.
      const count = mobile ? 70 : 130;
      for (let i = 0; i < count; i++) {
        const kind = KINDS[i % KINDS.length];
        const el = add(createParticle(kind));
        const duration = r(1.8, 3.2);
        // La plupart partent vers le haut (entre -165° et -15°), quelques-unes dans tous les sens.
        const angle = i % 5 === 0 ? r(0, 360) : r(-165, -15);
        const velocity = kind === "dust" ? r(200, 650) : r(mobile ? 280 : 350, mobile ? 720 : 980);
        gsap.to(el, {
          duration,
          physics2D: { velocity, angle, gravity: kind === "dust" ? 380 : 820, friction: kind === "confetti" ? 0.02 : 0 },
          rotation: r(-900, 900),
          ease: "none",
        });
        // Pièces qui tournent sur elles-mêmes, confettis qui virevoltent
        if (kind === "coin" || kind === "confetti") {
          const flip = r(0.12, 0.3);
          gsap.to(el, { scaleX: 0.15, duration: flip, repeat: Math.ceil(duration / flip), yoyo: true, ease: "sine.inOut" });
        }
        if (kind === "star" || kind === "dust") {
          // Scintillement, terminé avant le fondu final (nombre impair d'allers-retours = finit allumé)
          const twinkle = r(0.1, 0.25);
          const legs = Math.floor((duration - 0.8) / twinkle);
          if (legs >= 1) gsap.to(el, { opacity: 0.25, duration: twinkle, repeat: legs % 2 ? legs : legs - 1, yoyo: true, ease: "sine.inOut" });
        }
        gsap.to(el, { opacity: 0, duration: 0.6, delay: duration - 0.6, overwrite: false });
      }

      // Nettoyage : on retire tous les éléments créés (fin de l'explosion ou nouvelle victoire).
      const cleanup = gsap.delayedCall(3.6, () => created.forEach((el) => el.remove()));
      return () => {
        cleanup.kill();
        created.forEach((el) => el.remove());
      };
    },
    { dependencies: [burst], revertOnUpdate: true },
  );

  if (!isClient) return null;
  return createPortal(<div ref={layer} aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" />, document.body);
}
