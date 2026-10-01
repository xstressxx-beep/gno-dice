"use client";

// Nombre à rouleaux (Framer Motion), comme un compteur mécanique :
// chaque chiffre est une bande verticale 0-9 qui tourne toujours vers le bas
// et fait au moins un tour complet quand il change. Les rouleaux démarrent en
// cascade (de gauche à droite) et se floutent légèrement quand ils vont vite.
// Les lecteurs d'écran lisent seulement la valeur finale.

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, useVelocity } from "framer-motion";
import { useReducedMotionPref } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AnimatedNumberProps = {
  value: number;
  /** Transforme le nombre en texte (ex. ugnot -> "12,5"). */
  format?: (n: number) => string;
  /** Valeur affichée au premier rendu (par défaut : la valeur elle-même). */
  from?: number;
  /** "slow" : deux tours de rouleau (gains, gros montants). */
  speed?: "fast" | "slow";
  className?: string;
};

const defaultFormat = (n: number) => Math.round(n).toLocaleString("fr-FR");

export function AnimatedNumber({ value, format = defaultFormat, from, speed = "fast", className }: AnimatedNumberProps) {
  const [shown, setShown] = useState(from ?? value);
  // On passe à la vraie valeur juste après le premier affichage : les rouleaux tournent.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const text = format(shown);
  const chars = text.split("");
  let digitIndex = 0;

  return (
    <span className={cn("inline-flex items-baseline tabular-nums", className)} aria-label={format(value)} role="text">
      {chars.map((c, i) => {
        // Clé comptée depuis la droite : un chiffre garde son rouleau si le nombre s'allonge
        const key = chars.length - i;
        if (c >= "0" && c <= "9") {
          const order = digitIndex++;
          return <Reel key={key} digit={Number(c)} order={order} loops={speed === "slow" ? 2 : 1} />;
        }
        return (
          <span key={key} aria-hidden>
            {c === " " || c === " " ? " " : c}
          </span>
        );
      })}
    </span>
  );
}

const STRIP = Array.from({ length: 30 }, (_, i) => i % 10);

function Reel({ digit, order, loops }: { digit: number; order: number; loops: number }) {
  const reduce = useReducedMotionPref();
  // Position sur la bande (en hauteurs de chiffre) ; la bande contient 0-9 trois fois.
  const pos = useMotionValue(digit);
  const current = useRef(digit);
  const y = useTransform(pos, (v) => `${-v}em`);
  // Flou proportionnel à la vitesse du rouleau
  const velocity = useVelocity(pos);
  const filter = useTransform(velocity, (v) => {
    const b = Math.min(Math.abs(v) * 0.06, 1.6);
    return b > 0.15 ? `blur(${b.toFixed(2)}px)` : "none";
  });

  useEffect(() => {
    if (digit === current.current) return;
    if (reduce) {
      pos.set(digit);
      current.current = digit;
      return;
    }
    // Toujours vers l'avant : au moins un tour complet, puis on retombe sur le bon chiffre
    const start = current.current % 10;
    pos.set(start);
    const target = digit + 10 * loops;
    current.current = digit;
    const controls = animate(pos, target, {
      type: "spring",
      stiffness: loops > 1 ? 38 : 70,
      damping: loops > 1 ? 13 : 15,
      mass: 1,
      delay: order * 0.06,
      onComplete: () => pos.set(digit),
    });
    return () => controls.stop();
  }, [digit, loops, order, pos, reduce]);

  return (
    <span aria-hidden className="relative inline-block h-[1em] w-[1ch] overflow-hidden leading-none" style={{ verticalAlign: "-0.12em" }}>
      <motion.span className="absolute inset-x-0 top-0 flex flex-col items-center" style={{ y, filter }}>
        {STRIP.map((d, i) => (
          <span key={i} className="block h-[1em] leading-none">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
