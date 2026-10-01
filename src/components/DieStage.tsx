"use client";

// Autour de la scène 3D : chargement, « bruitages visuels » et lancer d'essai.
// - la scène WebGL est chargée seulement dans le navigateur (next/dynamic)
// - elle s'arrête de dessiner quand elle sort de l'écran (économie de batterie)
// - à chaque choc du dé, un mot (« clac », « toc », « tic ») jaillit à l'endroit
//   du rebond, avec des cercles qui s'élargissent : on « voit » le bruit
// - un lancer à la main affiche le chiffre obtenu, en précisant que rien n'est misé

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/motion";
import { haptic } from "@/lib/fx";
import type { Impact, SceneFx } from "./DieScene";

const DieScene = dynamic(() => import("./DieScene"), { ssr: false, loading: () => <StageLoader /> });

type DieStageProps = {
  face: number;
  rolling: boolean;
  outcome: { id: number; roll: number } | null;
  fx: SceneFx;
  allowToy: boolean;
  onImpact?: (strength: number) => void;
  onLanded?: () => void;
  /** Texte sous le dé (consigne, attente, résultat). */
  caption?: ReactNode;
};

type Sound = { id: number; word: string; x: number; y: number; strength: number; tilt: number };

export function DieStage({ face, rolling, outcome, fx, allowToy, onImpact, onLanded, caption }: DieStageProps) {
  const reduceMotion = useReducedMotionPref();
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [toy, setToy] = useState<{ face: number; id: number } | null>(null);

  // La scène ne tourne que si elle est visible
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleImpact = useCallback(
    ({ strength, x, y }: Impact) => {
      haptic(Math.round(8 + 22 * strength));
      onImpact?.(strength);
      if (strength < 0.18) return;
      const word = strength > 0.7 ? "clac" : strength > 0.4 ? "toc" : "tic";
      const id = performance.now();
      setSounds((list) => [...list.slice(-3), { id, word, x, y, strength, tilt: (Math.random() - 0.5) * 24 }]);
      // Retiré une fois son animation finie
      window.setTimeout(() => setSounds((list) => list.filter((s) => s.id !== id)), 1200);
    },
    [onImpact],
  );

  const handleToy = useCallback((landed: number) => {
    setToy({ face: landed, id: Date.now() });
  }, []);

  // Le résultat d'essai disparaît tout seul
  useEffect(() => {
    if (!toy) return;
    const t = setTimeout(() => setToy(null), 2600);
    return () => clearTimeout(t);
  }, [toy]);

  return (
    <div ref={wrap} className="relative" data-cursor-label={allowToy ? "Lance-le" : undefined}>
      <div
        className="relative aspect-[5/4] w-full sm:aspect-[6/5]"
        // Bords adoucis : la scène se fond dans la page, sans cadre visible
        style={{
          maskImage: "radial-gradient(ellipse 62% 60% at 50% 50%, #000 45%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 62% 60% at 50% 50%, #000 45%, transparent 100%)",
        }}
      >
        <DieScene
          face={face}
          rolling={rolling}
          outcome={outcome}
          fx={fx}
          allowToy={allowToy}
          active={active}
          reduceMotion={reduceMotion}
          onImpact={handleImpact}
          onLanded={onLanded}
          onToyLanded={handleToy}
        />

        {/* Bruitages visuels */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <AnimatePresence>
            {sounds.map((s) => (
              <motion.div
                key={s.id}
                className="absolute"
                style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
              >
                {[0, 1].map((ring) => (
                  <motion.span
                    key={ring}
                    className="absolute left-0 top-0 rounded-full border border-signal/70"
                    style={{ width: 40, height: 16, marginLeft: -20, marginTop: -8 }}
                    initial={{ scale: 0.4, opacity: 0.9 }}
                    animate={{ scale: 3 + s.strength * 3 + ring * 1.5, opacity: 0 }}
                    transition={{ duration: 0.8 + ring * 0.25, ease: [0.16, 1, 0.3, 1], delay: ring * 0.06 }}
                  />
                ))}
                <motion.span
                  className="display-soft absolute -translate-x-1/2 italic text-chalk"
                  style={{ fontSize: `${1.1 + s.strength * 1.9}rem`, top: "-2.4em", rotate: s.tilt }}
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 0], y: -18, scale: 1.15 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], times: [0, 0.2, 1] }}
                >
                  {s.word}
                </motion.span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Sous le dé : le résultat d'un lancer d'essai, sinon la consigne / le résultat de la partie */}
      <div className="relative -mt-2 flex min-h-[5.5rem] items-start justify-center px-4 text-center" aria-live="polite">
        <AnimatePresence mode="wait">
          {toy ? (
            <motion.p
              key={`toy-${toy.id}`}
              className="flex items-baseline gap-2.5 text-[0.95rem] text-haze"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              Lancer d&apos;essai
              <span className="display-soft text-[2.75rem] leading-none text-chalk">{toy.face}</span>
              rien n&apos;est misé
            </motion.p>
          ) : (
            <motion.div key="caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {caption}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Pendant le chargement de la 3D : le contour d'un dé se dessine. */
function StageLoader() {
  return (
    <div className="absolute inset-0 grid place-items-center" role="status" aria-label="Chargement du dé">
      <svg viewBox="0 0 100 100" className="size-16">
        <motion.rect
          x="10"
          y="10"
          width="80"
          height="80"
          rx="14"
          fill="none"
          stroke="#E3173E"
          strokeWidth="2"
          initial={{ pathLength: 0, rotate: 0 }}
          animate={{ pathLength: [0, 1, 1], rotate: [0, 0, 90], opacity: [1, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
          style={{ originX: "50%", originY: "50%" }}
        />
      </svg>
    </div>
  );
}
