"use client";

// Curseur personnalisé (GSAP), uniquement sur ordinateur (souris) :
// - un point doré qui suit la souris instantanément
// - un anneau qui le suit avec un léger retard et qui « s'aimante » aux
//   éléments cliquables : il prend leur taille et se colle à leur centre
// - une traînée lumineuse dorée dessinée sur un <canvas>
// - les éléments marqués `data-magnetic` sont attirés par la souris
// - un clic fait jaillir une petite gerbe d'étincelles
// Sur mobile, ou si l'utilisateur a demandé moins d'animations, rien ne change.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { sparkBurst } from "@/lib/fx";

const INTERACTIVE = 'a, button, [role="button"], [role="slider"], [role="tab"], [role="radio"], label, select, summary, [data-cursor]';
const TEXT_FIELDS = "input, textarea, [contenteditable='true']";
// Nombre de points gardés pour dessiner la traînée
const TRAIL_LENGTH = 22;
const RING_SIZE = 34;

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const canvas = canvasRef.current;
    if (!finePointer || reduceMotion || !dot || !ring || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    document.documentElement.classList.add("has-custom-cursor");

    // --- Positions animées (quickTo = très performant pour suivre la souris) ---
    const dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power3" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power3" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3" });
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 });

    let visible = false;
    let hovered: Element | null = null;
    let magnet: HTMLElement | null = null;
    const trail: { x: number; y: number }[] = [];
    const mouse = { x: -100, y: -100 };

    // --- Canvas plein écran (net sur les écrans haute densité) ---
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    /** L'anneau prend la forme de l'élément survolé (ou reprend sa taille normale). */
    const shapeRing = (target: Element | null) => {
      if (target && !target.matches(":disabled, [aria-disabled='true'], [data-disabled]")) {
        const box = target.getBoundingClientRect();
        const radius = parseFloat(getComputedStyle(target).borderRadius) || 12;
        gsap.to(ring, {
          width: box.width + 12,
          height: box.height + 12,
          borderRadius: Math.min(radius + 6, (box.height + 12) / 2),
          backgroundColor: "rgba(245,197,66,0.07)",
          borderColor: "rgba(253,231,161,0.75)",
          duration: 0.35,
          ease: "power3.out",
        });
        gsap.to(dot, { scale: 0.5, duration: 0.25 });
      } else {
        gsap.to(ring, {
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          backgroundColor: "rgba(245,197,66,0)",
          borderColor: "rgba(245,197,66,0.55)",
          duration: 0.35,
          ease: "power3.out",
        });
        gsap.to(dot, { scale: 1, duration: 0.25 });
      }
    };

    /** Relâche l'élément aimanté : il revient à sa place avec un petit rebond. */
    const releaseMagnet = () => {
      if (!magnet) return;
      gsap.to(magnet, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
      magnet = null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!visible) {
        visible = true;
        gsap.set([dot, ring], { x: mouse.x, y: mouse.y });
        gsap.to([dot, ring], { opacity: 1, duration: 0.3 });
      }
      dotX(mouse.x);
      dotY(mouse.y);

      const target = e.target instanceof Element ? e.target : null;
      const overText = !!target?.closest(TEXT_FIELDS);
      gsap.to([dot, ring], { autoAlpha: overText ? 0 : 1, duration: 0.2, overwrite: "auto" });

      // Projecteur des cartes : position de la souris dans la carte survolée
      const card = target?.closest<HTMLElement>("[data-spotlight]");
      if (card) {
        const box = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${mouse.x - box.left}px`);
        card.style.setProperty("--my", `${mouse.y - box.top}px`);
      }

      const interactive = target?.closest(INTERACTIVE) ?? null;
      if (interactive !== hovered) {
        hovered = interactive;
        shapeRing(interactive);
      }

      // L'élément aimanté suit la souris d'une fraction de la distance à son centre.
      const nextMagnet = (target?.closest("[data-magnetic]") as HTMLElement | null) ?? null;
      if (nextMagnet !== magnet) {
        releaseMagnet();
        magnet = nextMagnet;
      }
      if (magnet) {
        const box = magnet.getBoundingClientRect();
        const strength = Number(magnet.dataset.magnetic) || 0.3;
        // centre « au repos » : on retire le décalage déjà appliqué
        const cx = box.left + box.width / 2 - (Number(gsap.getProperty(magnet, "x")) || 0);
        const cy = box.top + box.height / 2 - (Number(gsap.getProperty(magnet, "y")) || 0);
        gsap.to(magnet, { x: (mouse.x - cx) * strength, y: (mouse.y - cy) * strength, duration: 0.4, ease: "power3.out" });
      }

      // L'anneau se colle au centre de l'élément survolé, sinon il suit la souris.
      if (hovered && !hovered.matches(":disabled")) {
        const box = hovered.getBoundingClientRect();
        ringX(box.left + box.width / 2 + (mouse.x - (box.left + box.width / 2)) * 0.12);
        ringY(box.top + box.height / 2 + (mouse.y - (box.top + box.height / 2)) * 0.12);
      } else {
        ringX(mouse.x);
        ringY(mouse.y);
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      gsap.to(ring, { scale: 0.85, duration: 0.12 });
      gsap.to(dot, { scale: 1.8, duration: 0.12 });
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      gsap.to(ring, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" });
      gsap.to(dot, { scale: hovered ? 0.5 : 1, duration: 0.3 });
      sparkBurst(e.clientX, e.clientY, { count: 8, spread: 34, ring: false });
    };
    const onLeave = () => {
      visible = false;
      gsap.to([dot, ring], { opacity: 0, duration: 0.3 });
      releaseMagnet();
    };
    // Après un défilement, l'élément sous la souris peut avoir changé.
    const onScroll = () => {
      if (hovered) {
        hovered = null;
        shapeRing(null);
      }
    };

    // --- Traînée lumineuse, redessinée à chaque image ---
    const draw = () => {
      if (visible) trail.push({ x: mouse.x, y: mouse.y });
      while (trail.length > TRAIL_LENGTH || (!visible && trail.length > 0)) trail.shift();
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (trail.length < 2) return;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const t = i / trail.length; // 0 = queue, 1 = tête
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(245, 197, 66, ${t * 0.55})`;
        ctx.lineWidth = t * 4;
        ctx.shadowColor = "rgba(245, 197, 66, 0.9)";
        ctx.shadowBlur = 10 * t;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    };
    gsap.ticker.add(draw);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      gsap.ticker.remove(draw);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove("has-custom-cursor");
      releaseMagnet();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] hidden [@media(hover:hover)_and_(pointer:fine)]:block">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div
        ref={ringRef}
        className="absolute left-0 top-0 rounded-full border border-primary/55"
        style={{ width: RING_SIZE, height: RING_SIZE, opacity: 0 }}
      />
      <div ref={dotRef} className="absolute left-0 top-0 size-2 rounded-full bg-gold-200 shadow-[0_0_12px_2px_rgba(245,197,66,0.8)]" style={{ opacity: 0 }} />
    </div>
  );
}
