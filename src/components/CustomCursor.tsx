"use client";

// Curseur personnalisé (GSAP), uniquement sur ordinateur (souris) :
// - un point qui suit la souris instantanément
// - un anneau qui suit avec un léger retard et s'étire dans le sens du mouvement
//   (plus on va vite, plus il s'allonge)
// - aimant intelligent : près d'un élément cliquable, l'anneau prend sa forme et
//   se colle à son centre ; les éléments `data-magnetic` sont attirés par la souris
// - étiquette contextuelle : `data-cursor-label="Lancer"` affiche un mot à côté
// - un clic fait jaillir une petite gerbe d'éclats
// Sur mobile, ou si l'utilisateur préfère moins d'animations, rien ne change.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { sparkBurst } from "@/lib/fx";
import { isReducedMotion } from "@/lib/motion";

const INTERACTIVE = 'a, button, [role="button"], [role="slider"], [role="tab"], [role="radio"], label, select, summary, [data-cursor]';
const TEXT_FIELDS = "input, textarea, [contenteditable='true']";
const RING_SIZE = 30;

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduceMotion = isReducedMotion();
    const dot = dotRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;
    if (!finePointer || reduceMotion || !dot || !ring || !label) return;

    document.documentElement.classList.add("has-custom-cursor");

    // quickTo : très performant pour suivre la souris
    const dotX = gsap.quickTo(dot, "x", { duration: 0.06, ease: "power3" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.06, ease: "power3" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.32, ease: "power3" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.32, ease: "power3" });
    const labelX = gsap.quickTo(label, "x", { duration: 0.45, ease: "power3" });
    const labelY = gsap.quickTo(label, "y", { duration: 0.45, ease: "power3" });
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 });
    gsap.set(label, { opacity: 0, scale: 0.6 });

    let visible = false;
    let hovered: Element | null = null;
    let magnet: HTMLElement | null = null;
    let currentLabel = "";
    const mouse = { x: -100, y: -100, vx: 0, vy: 0, t: performance.now() };

    /** L'anneau prend la forme de l'élément survolé (ou reprend sa taille normale). */
    const shapeRing = (target: Element | null) => {
      if (target && !target.matches(":disabled, [aria-disabled='true'], [data-disabled]")) {
        const box = target.getBoundingClientRect();
        const pad = 10;
        const radius = parseFloat(getComputedStyle(target).borderRadius) || 10;
        gsap.to(ring, {
          width: box.width + pad,
          height: box.height + pad,
          borderRadius: Math.min(radius + pad / 2, (box.height + pad) / 2),
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          borderColor: "rgba(239,234,223,0.55)",
          backgroundColor: "rgba(239,234,223,0.04)",
          duration: 0.4,
          ease: "expo.out",
        });
        gsap.to(dot, { scale: 0, duration: 0.2 });
      } else {
        gsap.to(ring, {
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          borderColor: "rgba(239,234,223,0.4)",
          backgroundColor: "rgba(239,234,223,0)",
          duration: 0.4,
          ease: "expo.out",
        });
        gsap.to(dot, { scale: 1, duration: 0.2 });
      }
    };

    const setLabel = (text: string) => {
      if (text === currentLabel) return;
      currentLabel = text;
      if (text) {
        label.textContent = text;
        gsap.to(label, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" });
      } else {
        gsap.to(label, { opacity: 0, scale: 0.6, duration: 0.2 });
      }
    };

    /** Relâche l'élément aimanté : il revient à sa place avec un petit rebond. */
    const releaseMagnet = () => {
      if (!magnet) return;
      gsap.to(magnet, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.35)" });
      magnet = null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      const dt = Math.max(1, now - mouse.t);
      mouse.vx = mouse.vx * 0.6 + ((e.clientX - mouse.x) / dt) * 0.4;
      mouse.vy = mouse.vy * 0.6 + ((e.clientY - mouse.y) / dt) * 0.4;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.t = now;

      if (!visible) {
        visible = true;
        gsap.set([dot, ring], { x: mouse.x, y: mouse.y });
        gsap.set(label, { x: mouse.x + 22, y: mouse.y + 18 });
        gsap.to([dot, ring], { opacity: 1, duration: 0.3 });
      }
      dotX(mouse.x);
      dotY(mouse.y);
      labelX(mouse.x + 22);
      labelY(mouse.y + 18);

      const target = e.target instanceof Element ? e.target : null;
      const overText = !!target?.closest(TEXT_FIELDS);
      gsap.to([dot, ring], { autoAlpha: overText ? 0 : 1, duration: 0.2, overwrite: "auto" });

      // Projecteur des panneaux : position de la souris dans le panneau survolé
      const card = target?.closest<HTMLElement>("[data-spotlight]");
      if (card) {
        const box = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${mouse.x - box.left}px`);
        card.style.setProperty("--my", `${mouse.y - box.top}px`);
      }

      setLabel(target?.closest<HTMLElement>("[data-cursor-label]")?.dataset.cursorLabel ?? "");

      const interactive = target?.closest(INTERACTIVE) ?? null;
      if (interactive !== hovered) {
        hovered = interactive;
        shapeRing(interactive);
      }

      // Aimant : l'élément suit la souris d'une fraction de la distance à son centre
      const nextMagnet = (target?.closest("[data-magnetic]") as HTMLElement | null) ?? null;
      if (nextMagnet !== magnet) {
        releaseMagnet();
        magnet = nextMagnet;
      }
      if (magnet) {
        const box = magnet.getBoundingClientRect();
        const strength = Number(magnet.dataset.magnetic) || 0.3;
        const cx = box.left + box.width / 2 - (Number(gsap.getProperty(magnet, "x")) || 0);
        const cy = box.top + box.height / 2 - (Number(gsap.getProperty(magnet, "y")) || 0);
        gsap.to(magnet, { x: (mouse.x - cx) * strength, y: (mouse.y - cy) * strength, duration: 0.5, ease: "power3.out" });
      }

      if (hovered && !hovered.matches(":disabled")) {
        // Collé au centre de l'élément, avec un léger jeu vers la souris
        const box = hovered.getBoundingClientRect();
        ringX(box.left + box.width / 2 + (mouse.x - (box.left + box.width / 2)) * 0.1);
        ringY(box.top + box.height / 2 + (mouse.y - (box.top + box.height / 2)) * 0.1);
      } else {
        ringX(mouse.x);
        ringY(mouse.y);
        // Étirement dans le sens du mouvement
        const speed = Math.hypot(mouse.vx, mouse.vy);
        const stretch = Math.min(speed * 0.18, 0.55);
        gsap.to(ring, {
          rotation: (Math.atan2(mouse.vy, mouse.vx) * 180) / Math.PI,
          scaleX: 1 + stretch,
          scaleY: 1 - stretch * 0.45,
          duration: 0.25,
          overwrite: "auto",
        });
      }
    };

    // Au repos, l'anneau reprend sa forme ronde
    const relax = gsap.delayedCall(0.12, () => undefined);
    const settle = () => {
      if (!hovered) gsap.to(ring, { scaleX: 1, scaleY: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" });
    };
    const onMoveEnd = () => {
      relax.restart(true);
      relax.eventCallback("onComplete", settle);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      gsap.to(ring, { scale: 0.82, duration: 0.12 });
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      gsap.to(ring, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.45)" });
      sparkBurst(e.clientX, e.clientY, { count: 8, spread: 30, ring: false });
    };
    const onLeave = () => {
      visible = false;
      gsap.to([dot, ring, label], { opacity: 0, duration: 0.3 });
      currentLabel = "";
      releaseMagnet();
    };
    // Après un défilement, l'élément sous la souris peut avoir changé.
    const onScroll = () => {
      if (hovered) {
        hovered = null;
        shapeRing(null);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointermove", onMoveEnd, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      relax.kill();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointermove", onMoveEnd);
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
      <div
        ref={ringRef}
        className="absolute left-0 top-0 rounded-full border border-chalk/40"
        style={{ width: RING_SIZE, height: RING_SIZE, opacity: 0 }}
      />
      <div ref={dotRef} className="absolute left-0 top-0 size-1.5 rounded-full bg-chalk" style={{ opacity: 0 }} />
      <div
        ref={labelRef}
        className="absolute left-0 top-0 origin-top-left whitespace-nowrap rounded-full bg-chalk px-2.5 py-1 text-xs font-medium text-lapis"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
