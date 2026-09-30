"use client";

// Décor lumineux derrière tout le site, animé avec GSAP :
// - de grands halos dorés (et un rouge) qui dérivent lentement
// - de la poussière d'or qui monte doucement en scintillant
// Tout est en arrière-plan (pointer-events: none) : aucun impact sur les clics.
// Si l'utilisateur a demandé moins d'animations (réglage système), le décor reste fixe.

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const ORBS = [
  { className: "left-[-15%] top-[-20%] h-[70vmax] w-[70vmax]", color: "rgba(245,197,66,0.10)" },
  { className: "right-[-25%] top-[25%] h-[60vmax] w-[60vmax]", color: "rgba(200,16,46,0.08)" },
  { className: "bottom-[-30%] left-[20%] h-[65vmax] w-[65vmax]", color: "rgba(245,197,66,0.07)" },
];

const DUST_COUNT = 34;

export function LuxuryBackdrop() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { motionOk: "(prefers-reduced-motion: no-preference)", mobile: "(max-width: 639px)" },
        (ctx) => {
          const { motionOk, mobile } = ctx.conditions as { motionOk: boolean; mobile: boolean };
          const r = gsap.utils.random;
          const dust = gsap.utils.toArray<HTMLElement>(".gd-dust");
          // Moins de particules sur mobile pour économiser la batterie
          const active = mobile ? dust.slice(0, 16) : dust;
          gsap.set(dust, { autoAlpha: 0 });

          if (!motionOk) {
            // Décor fixe : quelques paillettes immobiles
            active.forEach((el) => gsap.set(el, { left: `${r(0, 100)}%`, top: `${r(0, 100)}%`, scale: r(0.5, 1.4), autoAlpha: 0.45 }));
            return;
          }

          // Halos : dérive lente, aller-retour infini
          gsap.utils.toArray<HTMLElement>(".gd-orb").forEach((orb, i) => {
            gsap.to(orb, {
              x: () => r(-120, 120),
              y: () => r(-90, 90),
              scale: r(0.9, 1.15),
              duration: r(14, 22),
              delay: i * 1.5,
              repeat: -1,
              yoyo: true,
              repeatRefresh: true,
              ease: "sine.inOut",
            });
          });

          // Poussière d'or : monte, scintille, disparaît puis recommence ailleurs.
          // repeatRefresh : les valeurs « () => … » sont retirées au sort à chaque tour.
          active.forEach((el) => {
            const duration = r(9, 18);
            gsap
              .timeline({ repeat: -1, repeatRefresh: true, delay: r(0, 8) })
              .set(el, { left: () => `${r(0, 100)}%`, top: () => `${r(55, 105)}%`, scale: () => r(0.5, 1.4), x: 0, y: 0, autoAlpha: 0 })
              .to(el, { autoAlpha: () => r(0.35, 0.9), duration: 1.5, ease: "sine.out" })
              .to(el, { y: () => -r(250, 600), x: () => r(-60, 60), duration, ease: "none" }, 0)
              .to(el, { autoAlpha: 0, duration: 2, ease: "sine.in" }, duration - 2);
          });
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {ORBS.map((orb) => (
        <div
          key={orb.className}
          className={`gd-orb absolute rounded-full ${orb.className}`}
          style={{ background: `radial-gradient(circle, ${orb.color} 0%, transparent 65%)` }}
        />
      ))}
      {Array.from({ length: DUST_COUNT }, (_, i) => (
        <span
          key={i}
          className="gd-dust absolute size-1 rounded-full bg-gold-100 opacity-0 shadow-[0_0_6px_2px_rgba(245,197,66,0.6)]"
        />
      ))}
      {/* Vignette : assombrit les bords pour un rendu « salle de casino » */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)]" />
    </div>
  );
}
