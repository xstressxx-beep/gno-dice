"use client";

// Le grand dé en 3D, animé avec Framer Motion.
// C'est un vrai cube CSS : 6 faces placées dans l'espace (FACE_TRANSFORMS),
// puis on fait tourner le cube entier sur deux axes (rotateX / rotateY).
// - pendant un lancer : il tourne et rebondit sans s'arrêter
// - à la fin : il fait encore 2 tours, rebondit et se pose sur la bonne face
// - au repos : il flotte doucement et pivote vers le chiffre choisi

import { useEffect, useRef, type CSSProperties } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { FACE_ROTATIONS, FACE_TRANSFORMS, FACES, landingRotation } from "@/lib/dice";
import { cn } from "@/lib/utils";
import { PIPS } from "./Die";

type Dice3DProps = {
  /** Face à montrer quand le dé ne roule pas (1 à 6). */
  value: number;
  /** true pendant le lancer : le dé tourne en continu. */
  rolling: boolean;
  /** Dé en or (victoire). */
  gold?: boolean;
  /** Appelé quand le dé s'est posé après un lancer. */
  onLanded?: () => void;
  className?: string;
};

// Inclinaison fixe pour voir le dessus et le côté droit du dé (effet 3D).
const TILT = "rotateX(-24deg) rotateY(-32deg)";

// Courbe de ralentissement de l'atterrissage : très rapide puis très douce.
const LANDING_EASE = [0.1, 0.75, 0.2, 1] as const;

const FACE_STYLE = {
  ivory: {
    background: "radial-gradient(circle at 30% 22%, #fffef9 0%, #f4ecd6 52%, #d8c69c 100%)",
    boxShadow: "inset 0 0 0 1px rgba(140, 105, 40, 0.28), inset 0 -8px 18px rgba(140, 105, 40, 0.28)",
    core: "#cdb989",
  },
  gold: {
    background: "radial-gradient(circle at 30% 22%, #fff7d6 0%, #f5c542 48%, #a8760a 100%)",
    boxShadow: "inset 0 0 0 1px rgba(90, 60, 0, 0.35), inset 0 -8px 18px rgba(110, 70, 0, 0.4)",
    core: "#b8860b",
  },
};

function pipStyle(face: number, gold: boolean): string {
  if (gold) return "radial-gradient(circle at 35% 30%, #5a3d00 0%, #1c1200 100%)";
  if (face === 1) return "radial-gradient(circle at 35% 30%, #ff6b6b 0%, #a80f1f 100%)";
  return "radial-gradient(circle at 35% 30%, #4d4d4d 0%, #090909 100%)";
}

/**
 * La taille vient de la variable CSS `--die` (120px par défaut), modifiable
 * avec une classe, ex. `[--die:96px] sm:[--die:124px]` : le dé s'adapte au mobile.
 */
export function Dice3D({ value, rolling, gold = false, onLanded, className }: Dice3DProps) {
  const reduceMotion = useReducedMotion();

  // Valeurs animées : rotation du cube (en degrés) et hauteur du saut (en px).
  const start = FACE_ROTATIONS[value] ?? FACE_ROTATIONS[1];
  const rotateX = useMotionValue(start.x);
  const rotateY = useMotionValue(start.y);
  const lift = useMotionValue(0);

  // L'ombre rétrécit et s'éclaircit quand le dé est en l'air.
  const shadowScale = useTransform(lift, [-60, 0], [0.45, 1]);
  const shadowOpacity = useTransform(lift, [-60, 0], [0.25, 0.75]);

  const wasRolling = useRef(false);
  // Toujours la dernière version du callback, sans relancer les animations.
  const onLandedRef = useRef(onLanded);
  useEffect(() => {
    onLandedRef.current = onLanded;
  });

  // 1) Le dé roule en continu pendant le lancer.
  useEffect(() => {
    if (!rolling) return;
    wasRolling.current = true;
    if (reduceMotion) return;
    const controls = [
      animate(rotateX, rotateX.get() - 360, { duration: 0.46, ease: "linear", repeat: Infinity }),
      animate(rotateY, rotateY.get() + 360, { duration: 0.7, ease: "linear", repeat: Infinity }),
      animate(lift, [0, -36, 0], { duration: 0.46, ease: ["easeOut", "easeIn"], repeat: Infinity }),
    ];
    return () => controls.forEach((c) => c.stop());
  }, [rolling, reduceMotion, rotateX, rotateY, lift]);

  // 2) Le dé se pose sur `value` (après un lancer, ou quand on change de chiffre).
  useEffect(() => {
    if (rolling) return;
    const afterRoll = wasRolling.current;
    wasRolling.current = false;
    const target = landingRotation(value, { x: rotateX.get(), y: rotateY.get() }, afterRoll && !reduceMotion ? 2 : 0);

    if (reduceMotion) {
      rotateX.set(target.x);
      rotateY.set(target.y);
      lift.set(0);
      if (afterRoll) onLandedRef.current?.();
      return;
    }

    let cancelled = false;
    const controls = afterRoll
      ? [
          animate(rotateX, target.x, { duration: 1.6, ease: LANDING_EASE }),
          animate(rotateY, target.y, { duration: 1.6, ease: LANDING_EASE }),
          // Rebonds de plus en plus petits, comme un vrai dé sur un tapis
          animate(lift, [lift.get(), -44, 0, -14, 0, -4, 0], {
            duration: 1.25,
            times: [0, 0.22, 0.48, 0.64, 0.8, 0.9, 1],
            ease: "easeInOut",
          }),
        ]
      : [
          animate(rotateX, target.x, { type: "spring", stiffness: 170, damping: 15 }),
          animate(rotateY, target.y, { type: "spring", stiffness: 170, damping: 15 }),
          animate(lift, 0, { duration: 0.25 }),
        ];

    if (afterRoll) {
      Promise.all([controls[0].finished, controls[1].finished]).then(() => {
        if (!cancelled) onLandedRef.current?.();
      });
    }
    return () => {
      cancelled = true;
      controls.forEach((c) => c.stop());
    };
  }, [rolling, value, reduceMotion, rotateX, rotateY, lift]);

  const look = gold ? FACE_STYLE.gold : FACE_STYLE.ivory;

  return (
    <div
      className={cn("relative flex items-center justify-center [--die:120px]", className)}
      style={{ width: "calc(var(--die) * 1.8)", height: "calc(var(--die) * 2)" }}
    >
      {/* Halo lumineux derrière le dé (en dehors du cube : un filtre casserait la 3D) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: "calc(var(--die) * 2.1)", height: "calc(var(--die) * 2.1)" }}
        animate={{
          background: gold
            ? "radial-gradient(circle, rgba(245,197,66,0.55) 0%, rgba(245,197,66,0.12) 45%, rgba(245,197,66,0) 70%)"
            : "radial-gradient(circle, rgba(245,197,66,0.16) 0%, rgba(245,197,66,0.04) 45%, rgba(245,197,66,0) 70%)",
        }}
        transition={{ duration: 0.6 }}
      />

      {/* Ombre au sol */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-[6%] left-1/2 rounded-[50%] bg-black blur-md"
        style={{ width: "calc(var(--die) * 1.1)", height: "calc(var(--die) * 0.22)", x: "-50%", scale: shadowScale, opacity: shadowOpacity }}
      />

      {/* Flottement doux au repos */}
      <motion.div
        className="relative"
        style={{ perspective: "calc(var(--die) * 7)", marginBottom: "calc(var(--die) * 0.25)" }}
        animate={rolling ? { y: 0 } : { y: [0, -7, 0] }}
        transition={rolling ? { duration: 0.2 } : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Saut */}
        <motion.div style={{ y: lift, transformStyle: "preserve-3d" }}>
          {/* Inclinaison fixe */}
          <div style={{ transform: TILT, transformStyle: "preserve-3d" }}>
            {/* Le cube qui tourne */}
            <motion.div className="relative" style={{ width: "var(--die)", height: "var(--die)", rotateX, rotateY, transformStyle: "preserve-3d" }}>
              {/* Cœur du dé : remplit les coins arrondis vus de biais */}
              {["rotateX(90deg)", "rotateY(90deg)", "none"].map((t) => (
                <div key={t} aria-hidden className="absolute inset-[3%] rounded-[10%]" style={{ transform: t, background: look.core }} />
              ))}
              {FACES.map((face) => (
                <div
                  key={face}
                  aria-hidden
                  className="absolute inset-0 overflow-hidden rounded-[18%] [backface-visibility:hidden]"
                  style={{
                    transform: `${FACE_TRANSFORMS[face]} translateZ(calc(var(--die) / 2))`,
                    background: look.background,
                    boxShadow: look.boxShadow,
                  }}
                >
                  {PIPS[face].map(([x, y]) => (
                    <span
                      key={`${x}-${y}`}
                      className="absolute rounded-full"
                      style={
                        {
                          left: `${x}%`,
                          top: `${y}%`,
                          width: face === 1 ? "calc(var(--die) * 0.24)" : "calc(var(--die) * 0.19)",
                          height: face === 1 ? "calc(var(--die) * 0.24)" : "calc(var(--die) * 0.19)",
                          transform: "translate(-50%, -50%)",
                          background: pipStyle(face, gold),
                          boxShadow: "inset 0 2px 3px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.45)",
                        } satisfies CSSProperties
                      }
                    />
                  ))}
                  {/* Reflet de lumière sur la face */}
                  <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.45)_0%,transparent_38%)]" />
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
