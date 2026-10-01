"use client";

// Écran d'introduction (GSAP), une seule fois par visite. Il raconte un lancer :
// 1. un grand chiffre défile de 1 à 6 de plus en plus lentement, comme un dé qui roule
// 2. il s'arrête, s'écrase un instant (le choc) et le nom du site apparaît
// 3. le rideau s'ouvre en deux vers le haut et le bas, et la table apparaît
// Un petit script dans layout.tsx masque l'intro si elle a déjà été vue.

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { markIntroDone } from "@/hooks/useIntroDone";
import { isReducedMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

export const INTRO_KEY = "gd-intro";

// Suite des chiffres affichés : de plus en plus espacés dans le temps
const SEQUENCE = [3, 6, 2, 5, 1, 4, 2, 6, 3, 5, 6];

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const seen = document.documentElement.classList.contains("intro-seen");
      const reduceMotion = isReducedMotion();
      // Page ouverte dans un onglet en arrière-plan : personne ne verrait l'intro
      const hidden = document.visibilityState === "hidden";
      if (seen || reduceMotion || hidden) {
        markIntroDone();
        setDone(true);
        return;
      }
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {
        // navigation privée : l'intro rejouera, ce n'est pas grave
      }
      document.documentElement.style.overflow = "hidden";

      const digit = el.querySelector<HTMLElement>(".pl-digit");
      const tl = gsap.timeline({
        onComplete: () => {
          document.documentElement.style.overflow = "";
          setDone(true);
        },
      });

      // 1) Le chiffre roule : chaque changement attend un peu plus que le précédent
      let at = 0.15;
      SEQUENCE.forEach((n, i) => {
        tl.call(() => digit && (digit.textContent = String(n)), [], at);
        tl.fromTo(".pl-digit", { yPercent: -18, opacity: 0.4 }, { yPercent: 0, opacity: 1, duration: 0.08, ease: "power2.out" }, at);
        at += 0.045 + i * i * 0.0045;
      });

      // 2) Le choc : écrasement, la graisse de la police monte d'un coup
      tl.to(".pl-digit", { scaleY: 0.82, scaleX: 1.12, duration: 0.09, ease: "power2.in" }, at)
        .to(".pl-digit", { scaleY: 1, scaleX: 1, duration: 0.6, ease: "elastic.out(1, 0.35)" }, at + 0.09)
        .fromTo(".pl-digit", { "--wght": 300 }, { "--wght": 900, duration: 0.4, ease: "power3.out" }, at)
        .fromTo(".pl-ring", { scale: 0.4, opacity: 0.8 }, { scale: 2.6, opacity: 0, duration: 0.9, ease: "expo.out" }, at + 0.05)
        .fromTo(".pl-word", { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: "expo.out" }, at + 0.15);

      // 3) Le rideau s'ouvre en deux
      const open = at + 0.95;
      tl.to(".pl-content", { opacity: 0, scale: 0.96, duration: 0.3, ease: "power2.in" }, open - 0.15)
        .call(markIntroDone, [], open + 0.1)
        .to(".pl-top", { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, open)
        .to(".pl-bottom", { yPercent: 100, duration: 0.9, ease: "expo.inOut" }, open);
    },
    { scope: root },
  );

  if (done) return null;

  return (
    <div ref={root} aria-hidden className="preloader fixed inset-0 z-[90]">
      <div className="pl-top absolute inset-x-0 top-0 h-1/2 bg-lapis-950" />
      <div className="pl-bottom absolute inset-x-0 bottom-0 h-1/2 bg-lapis-950">
        <div className="absolute inset-x-0 top-0 h-px bg-ruby/50" />
      </div>
      <div className="pl-content absolute inset-0 grid place-items-center">
        <div className="relative flex flex-col items-center">
          <span className="pl-ring absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ruby opacity-0" />
          <span
            className="pl-digit display-soft block text-[clamp(8rem,24vw,15rem)] leading-[0.85] text-chalk"
            style={{ fontVariationSettings: '"wght" var(--wght, 300), "SOFT" 100, "WONK" 1, "opsz" 144' } as React.CSSProperties}
          >
            1
          </span>
          <span className="mt-4 block overflow-hidden">
            <span className="pl-word display-soft block translate-y-full text-2xl text-haze">gnodice</span>
          </span>
        </div>
      </div>
    </div>
  );
}
