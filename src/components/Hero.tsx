"use client";

// Section d'accueil, inspirée des pages produit Apple / Linear :
// - un grand titre qui apparaît mot par mot (masque + montée)
// - « ×5 » en or métallisé, traversé par un reflet
// - des dés qui flottent à plusieurs profondeurs : parallax au défilement
//   (Framer Motion useScroll) et à la souris (React Spring, physique de ressort)
// - deux boutons aimantés et une rangée de chiffres clés qui défilent

import { useEffect, useRef, type CSSProperties } from "react";
import { motion, useInView, useScroll, useSpring as useMotionSpring, useTransform, type MotionValue } from "framer-motion";
import { animated, to, useSpring, type SpringValues } from "@react-spring/web";
import { ArrowDown, ShieldCheck } from "lucide-react";
import { GAME } from "@/lib/config";
import { AnimatedNumber } from "./AnimatedNumber";
import { Die } from "./Die";
import { EASE_OUT_EXPO, Reveal } from "./Reveal";

// Dés décoratifs : position, taille, profondeur (plus `depth` est grand, plus le dé bouge).
const FLOATING = [
  { value: 5, size: 92, left: "7%", top: "22%", depth: 1.6, rotate: -18, blur: 0 },
  { value: 3, size: 54, left: "84%", top: "16%", depth: 1.1, rotate: 22, blur: 0 },
  { value: 6, size: 120, left: "79%", top: "62%", depth: 2.2, rotate: 12, blur: 1.5 },
  { value: 1, size: 40, left: "16%", top: "74%", depth: 0.7, rotate: 35, blur: 0.5 },
  { value: 2, size: 30, left: "58%", top: "8%", depth: 0.5, rotate: -30, blur: 1 },
];

// Le titre, ligne par ligne ; `gold` = mot en or métallisé.
const TITLE = [
  [{ text: "Devine" }, { text: "le" }, { text: "dé." }],
  [{ text: "Gagne" }, { text: "×5.", gold: true }],
];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Ressort sur le défilement : le parallax reste fluide même avec une molette saccadée.
  const progress = useMotionSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  const titleY = useTransform(progress, [0, 1], [0, -120]);
  const titleOpacity = useTransform(progress, [0, 0.7], [1, 0]);
  const titleScale = useTransform(progress, [0, 1], [1, 0.94]);

  // Position de la souris dans la section, de -1 à 1 (physique React Spring).
  const [mouse, api] = useSpring(() => ({ x: 0, y: 0, config: { mass: 2, tension: 120, friction: 30 } }));
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      api.start({ x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [api]);

  const scrollToTable = () => document.getElementById("table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToRules = () => document.getElementById("regles")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section ref={ref} className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden py-16 sm:min-h-[calc(100svh-72px)]">
      {/* Dés flottants (décor) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {FLOATING.map((d, i) => (
          <FloatingDie key={i} {...d} progress={progress} mouse={mouse} index={i} />
        ))}
      </div>

      {/* Projecteur doré derrière le titre */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] h-[60vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(245,197,66,0.16),transparent)]" />

      <motion.div style={{ y: titleY, opacity: titleOpacity, scale: titleScale }} className="page-container relative flex flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.3 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/[0.03] px-3.5 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-gold-100/90 backdrop-blur"
        >
          <ShieldCheck className="size-3.5 text-primary" /> 100 % on-chain · Gno.land
        </motion.p>

        <h1 className="mt-7 max-w-4xl text-[clamp(2.9rem,10vw,7.25rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-[#f7f1e3]">
          {TITLE.map((line, l) => (
            <span key={l} className="block">
              {line.map((w, i) => (
                <span key={w.text} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
                  <motion.span
                    className={"gold" in w ? "chrome-gold inline-block pr-[0.04em]" : "inline-block"}
                    initial={{ y: "110%", rotate: 6 }}
                    animate={{ y: "0%", rotate: 0 }}
                    transition={{ duration: 1.1, ease: EASE_OUT_EXPO, delay: 0.45 + (l * 3 + i) * 0.08 }}
                  >
                    {w.text}
                  </motion.span>
                  {i < line.length - 1 && <span className="inline-block w-[0.25em]" />}
                </span>
              ))}
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.95 }}
          className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-[#b9b2a3] sm:text-lg"
        >
          Choisis un chiffre, mise entre {GAME.minBetGnot} et {GAME.maxBetGnot} GNOT et lance le dé sur la blockchain. Transparent, vérifiable,
          sans intermédiaire.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 1.1 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <span data-magnetic="0.35" className="inline-block">
            <button
              type="button"
              onClick={scrollToTable}
              className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-gold-gradient px-7 text-[0.95rem] font-semibold text-primary-foreground shadow-gold transition-shadow duration-300 hover:shadow-gold-lg active:scale-[0.97]"
            >
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
              <span className="relative">Lancer le dé</span>
              <ArrowDown className="relative size-4 transition-transform duration-300 group-hover:translate-y-0.5" />
            </button>
          </span>
          <span data-magnetic="0.25" className="inline-block">
            <button
              type="button"
              onClick={scrollToRules}
              className="inline-flex h-12 items-center rounded-full border border-primary/30 px-7 text-[0.95rem] font-medium text-gold-100 transition-colors duration-300 hover:border-primary/70 hover:bg-primary/10 active:scale-[0.97]"
            >
              Comment ça marche
            </button>
          </span>
        </motion.div>
      </motion.div>

      {/* Chiffres clés */}
      <Reveal className="page-container relative mt-16 w-full sm:mt-20" delay={1.2} y={20}>
        <dl className="mx-auto grid max-w-3xl grid-cols-2 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-md sm:grid-cols-4">
          <Stat label="de ta mise" prefix="×" value={GAME.multiplier} />
          <Stat label="de chance" prefix="1/" value={6} />
          <Stat label="entre deux lancers" value={GAME.cooldownSeconds / 60} suffix=" min" />
          <Stat label="on-chain" value={100} suffix=" %" />
        </dl>
      </Reveal>

      {/* Indicateur de défilement */}
      <motion.div
        aria-hidden
        style={{ opacity: titleOpacity }}
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 sm:block"
      >
        <div className="flex h-9 w-5 justify-center rounded-full border border-primary/30 pt-1.5">
          <motion.span className="h-2 w-0.5 rounded-full bg-gold-200" animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        </div>
      </motion.div>
    </section>
  );
}

type MouseSpring = SpringValues<{ x: number; y: number }>;

function FloatingDie({
  value,
  size,
  left,
  top,
  depth,
  rotate,
  blur,
  progress,
  mouse,
  index,
}: (typeof FLOATING)[number] & { progress: MotionValue<number>; mouse: MouseSpring; index: number }) {
  // Défilement : les dés « proches » montent plus vite que les « lointains ».
  const y = useTransform(progress, [0, 1], [0, -260 * depth]);
  const rot = useTransform(progress, [0, 1], [rotate, rotate + 90 * depth]);

  return (
    <motion.div className="absolute" style={{ left, top, y, rotate: rot }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: blur > 1 ? 0.5 : 0.85, scale: 1 }}
        transition={{ duration: 1.4, ease: EASE_OUT_EXPO, delay: 0.6 + index * 0.1 }}
      >
        <animated.div
          style={{
            transform: to([mouse.x, mouse.y], (x, y) => `translate3d(${x * -18 * depth}px, ${y * -14 * depth}px, 0)`),
            filter: blur ? `blur(${blur}px)` : undefined,
          } as unknown as CSSProperties}
          className={index % 2 ? "animate-float-slow" : "animate-float"}
        >
          <Die
            value={value}
            size={size}
            variant={index === 0 || index === 2 ? "gold" : "ivory"}
            // Plus petits sur mobile pour ne pas gêner le titre
            style={{ width: `clamp(${Math.round(size * 0.55)}px, ${(size / 12).toFixed(1)}vw, ${size}px)`, height: "auto" }}
            className="drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]"
          />
        </animated.div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, prefix = "", suffix = "" }: { label: string; value: number; prefix?: string; suffix?: string }) {
  // Le compteur part de 0 seulement quand la case devient visible.
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="flex flex-col items-center gap-1 border-white/[0.06] px-4 py-5 text-center [&:not(:last-child)]:border-r max-sm:[&:nth-child(2)]:border-r-0 max-sm:[&:nth-child(-n+2)]:border-b">
      <dt className="order-2 text-xs text-[#9b9484]">{label}</dt>
      <dd className="order-1 text-2xl font-semibold tracking-tight text-[#f7f1e3] sm:text-3xl">
        {prefix}
        <AnimatedNumber value={inView ? value : 0} from={0} speed="slow" className="tabular-nums" />
        {suffix}
      </dd>
    </div>
  );
}
