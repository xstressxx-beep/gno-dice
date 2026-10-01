"use client";

// Bandeau des derniers lancers, qui défile sans fin (Framer Motion).
// Il accélère quand on fait défiler la page et change de sens si on remonte :
// la page semble réagir au moindre mouvement.
// Sans partie jouée, il rappelle les règles.

import { useRef } from "react";
import { motion, useAnimationFrame, useMotionValue, useScroll, useSpring, useTransform, useVelocity, wrap } from "framer-motion";
import { GAME } from "@/lib/config";
import { formatGnot, shortAddress } from "@/lib/format";
import type { Game } from "@/lib/gno";
import { Die } from "./Die";

const RULES = [
  "Un chiffre de 1 à 6",
  `Mise de ${GAME.minBetGnot} à ${GAME.maxBetGnot} GNOT`,
  `${GAME.multiplier} fois la mise si tu tombes juste`,
  "Un lancer toutes les dix minutes",
  "Tout est vérifiable sur Gno.land",
];

export function RollTicker({ recent }: { recent: Game[] }) {
  const items = recent.length > 0 ? recent.slice(0, 12) : null;

  // Vitesse de base + vitesse du défilement de la page
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const boost = useTransform(smoothVelocity, [-1500, 0, 1500], [-5, 0, 5], { clamp: false });
  const direction = useRef(1);
  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    const b = boost.get();
    if (b < 0) direction.current = -1;
    else if (b > 0) direction.current = 1;
    const move = direction.current * -1.6 * (delta / 1000) * (1 + Math.abs(b));
    baseX.set(baseX.get() + move);
  });

  const row = (
    <ul className="flex shrink-0 items-center gap-10 pr-10">
      {items
        ? items.map((g) => (
            <li key={g.id} className="flex items-center gap-3 whitespace-nowrap text-[0.95rem] text-haze">
              <Die value={g.roll} size={22} variant={g.won ? "ruby" : "chalk"} />
              <span>
                <span className="text-chalk/80">{shortAddress(g.player)}</span> a misé {formatGnot(g.bet)} sur le {g.guess}
              </span>
              {g.won ? <span className="text-ruby-light">+{formatGnot(g.payout)} GNOT</span> : <span>tombé sur le {g.roll}</span>}
            </li>
          ))
        : RULES.map((rule, i) => (
            <li key={rule} className="flex items-center gap-3 whitespace-nowrap text-[0.95rem] text-haze">
              <Die value={(i % 6) + 1} size={20} variant="ghost" />
              {rule}
            </li>
          ))}
    </ul>
  );

  return (
    <section aria-label={items ? "Derniers lancers" : "Règles du jeu"} className="relative overflow-hidden border-y border-border/70 py-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <motion.div className="flex w-max" style={{ x }}>
        {row}
        <div aria-hidden className="flex">
          {row}
        </div>
      </motion.div>
    </section>
  );
}
