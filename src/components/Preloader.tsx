"use client";

// Écran d'introduction (GSAP), affiché une seule fois par visite :
// les points d'un dé doré s'allument un à un pendant qu'un compteur monte
// de 0 à 100, puis le rideau noir s'ouvre vers le haut sur le site.
// Un petit script dans layout.tsx ajoute la classe `intro-seen` si l'intro a déjà
// été vue : le CSS le masque alors avant même le premier affichage (pas de flash).

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { PIPS } from "./Die";

gsap.registerPlugin(useGSAP);

export const INTRO_KEY = "gd-intro";

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const seen = document.documentElement.classList.contains("intro-seen");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (seen || reduceMotion) {
        setDone(true);
        return;
      }
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {
        // navigation privée : l'intro rejouera, ce n'est pas grave
      }
      document.documentElement.style.overflow = "hidden";

      const counter = { v: 0 };
      const counterEl = el.querySelector<HTMLElement>(".pl-count");
      const tl = gsap.timeline({
        onComplete: () => {
          document.documentElement.style.overflow = "";
          setDone(true);
        },
      });
      tl.from(".pl-die", { scale: 0.6, rotate: -90, opacity: 0, duration: 0.7, ease: "back.out(1.6)" })
        .from(".pl-pip", { scale: 0, opacity: 0, duration: 0.25, stagger: 0.09, ease: "back.out(3)" }, 0.25)
        .to(counter, { v: 100, duration: 1.1, ease: "power2.inOut", onUpdate: () => counterEl && (counterEl.textContent = String(Math.round(counter.v))) }, 0.1)
        .to(".pl-bar", { scaleX: 1, duration: 1.1, ease: "power2.inOut" }, 0.1)
        .to(".pl-die", { rotate: 360, scale: 1.15, duration: 0.5, ease: "power3.in" }, 1.2)
        .to(".pl-content", { opacity: 0, y: -20, duration: 0.35, ease: "power2.in" }, 1.45)
        .to(el, { yPercent: -100, duration: 0.85, ease: "expo.inOut" }, 1.6)
        .to(".pl-edge", { scaleY: 0, duration: 0.6, ease: "expo.out" }, 2.05);
    },
    { scope: root },
  );

  if (done) return null;

  return (
    <div ref={root} aria-hidden className="preloader fixed inset-0 z-[90] grid place-items-center bg-[#040404]">
      <div className="pl-content flex flex-col items-center gap-7">
        <svg viewBox="0 0 100 100" className="pl-die size-20 drop-shadow-[0_0_30px_rgba(245,197,66,0.5)]">
          <defs>
            <linearGradient id="pl-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fde7a1" />
              <stop offset="0.45" stopColor="#f5c542" />
              <stop offset="1" stopColor="#b8860b" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx="20" fill="url(#pl-gold)" />
          {PIPS[6].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} className="pl-pip" cx={cx} cy={cy} r="8.5" fill="#1d1403" style={{ transformOrigin: `${cx}px ${cy}px` }} />
          ))}
        </svg>
        <div className="flex w-48 flex-col items-center gap-3">
          <div className="h-px w-full overflow-hidden bg-primary/15">
            <div className="pl-bar h-full origin-left scale-x-0 bg-gold-gradient" />
          </div>
          <p className="flex w-full justify-between font-display text-[0.65rem] uppercase tracking-[0.35em] text-primary/80">
            <span>Gno-Dice</span>
            <span>
              <span className="pl-count tabular-nums">0</span>%
            </span>
          </p>
        </div>
      </div>
      {/* Liseré doré en bas du rideau */}
      <div className="pl-edge absolute inset-x-0 bottom-0 h-px origin-bottom bg-gradient-to-r from-transparent via-gold-300 to-transparent shadow-gold" />
    </div>
  );
}
