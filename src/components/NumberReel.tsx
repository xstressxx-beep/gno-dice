"use client";

// Bande de chiffres qui défile façon machine à sous, animée avec React Spring.
// Pendant le lancer, les chiffres 1 à 6 défilent à toute vitesse ; quand le
// résultat arrive, un ressort (spring) ralentit la bande qui dépasse un peu
// sa cible puis revient se caler sur le bon chiffre, comme un vrai rouleau.

import { useEffect } from "react";
import { animated, useReducedMotion, useSpring } from "@react-spring/web";
import { FACES, REEL_CYCLES, reelIndex } from "@/lib/dice";
import { cn } from "@/lib/utils";

type NumberReelProps = {
  /** true pendant le lancer : les chiffres défilent en boucle. */
  spinning: boolean;
  /** Chiffre sur lequel s'arrêter (null = pas encore de résultat). */
  value: number | null;
  /** Texte au-dessus de la fenêtre, ex. « Résultat ». */
  caption: string;
  /** Hauteur d'une case en pixels. */
  cell?: number;
  /** Mise en valeur dorée (victoire). */
  highlight?: boolean;
  className?: string;
};

// Tour de la bande sur lequel on s'arrête (on garde de la marge pour le rebond).
const LANDING_CYCLE = REEL_CYCLES - 2;
// Un tour complet (6 chiffres) en 0,33 s pendant le lancer.
const SPIN_MS = 330;

export function NumberReel({ spinning, value, caption, cell = 56, highlight = false, className }: NumberReelProps) {
  const [springs, api] = useSpring(() => ({ y: 0 }));
  // « Réduire les animations » activé sur l'appareil : pas de défilement en boucle.
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    if (spinning && !reduceMotion) {
      // Boucle : on repart du début du 2e tour à chaque fois (motif identique, donc invisible).
      api.start({
        from: { y: -reelIndex(1, 1) * cell },
        to: { y: -reelIndex(1, 2) * cell },
        loop: true,
        config: { duration: SPIN_MS },
      });
    } else if (value !== null) {
      // Atterrissage « à ressort » : faible frottement = petit rebond final.
      api.start({
        to: { y: -reelIndex(value, LANDING_CYCLE) * cell },
        loop: false,
        // Réglé pour se poser en même temps que le dé 3D (~1,6 s).
        config: { tension: 42, friction: 9.5, mass: 1.3 },
      });
    } else {
      // Pas de résultat (lancer annulé, ou animations réduites) : bande arrêtée.
      api.stop();
      api.set({ y: 0 });
    }
  }, [spinning, reduceMotion, value, cell, api]);

  const showStrip = (spinning && !reduceMotion) || value !== null;

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{caption}</span>
      <div
        className={cn(
          "relative overflow-hidden rounded-md border bg-gradient-to-b from-black via-[#120d05] to-black shadow-[inset_0_0_18px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow] duration-500",
          highlight ? "border-gold-300 shadow-gold-lg" : "border-primary/35",
        )}
        style={{ width: cell * 1.1, height: cell }}
      >
        {showStrip ? (
          <animated.div
            aria-hidden
            className={cn("absolute inset-x-0 top-0 transition-[filter] duration-200", spinning && "blur-[1.5px]")}
            style={{ y: springs.y }}
          >
            {Array.from({ length: REEL_CYCLES }, (_, cycle) =>
              FACES.map((face) => (
                <span
                  key={`${cycle}-${face}`}
                  className="gold-text flex items-center justify-center font-display font-extrabold leading-none"
                  style={{ height: cell, fontSize: cell * 0.58 }}
                >
                  {face}
                </span>
              )),
            )}
          </animated.div>
        ) : (
          <span aria-hidden className="flex h-full items-center justify-center font-display font-bold text-primary/40" style={{ fontSize: cell * 0.5 }}>
            {spinning ? "…" : "?"}
          </span>
        )}
        {/* Reflets haut et bas de la fenêtre */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/80 to-transparent" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
        <span className="pointer-events-none absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-primary/10" />
      </div>
      <span className="sr-only" aria-live="polite">
        {spinning ? `${caption} : en cours…` : value !== null ? `${caption} : ${value}` : ""}
      </span>
    </div>
  );
}
