"use client";

// « Retour haptique visuel » : les bords de l'écran réagissent au résultat.
// Victoire : un liseré rubis qui pulse deux fois. Défaite : l'obscurité se
// resserre brièvement autour de la page. Sur téléphone, une vraie vibration.

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "@/lib/fx";

export type Flash = { kind: "win" | "lose"; id: number };

const STYLES = {
  win: "inset 0 0 160px 24px rgba(227,23,62,0.38), inset 0 0 0 2px rgba(255,84,112,0.55)",
  lose: "inset 0 0 220px 80px rgba(2,4,20,0.85)",
};

const subscribe = () => () => {};

export function ScreenFlash({ flash }: { flash: Flash | null }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!flash) return;
    // Victoire : impulsions qui montent ; défaite : un choc sourd.
    haptic(flash.kind === "win" ? [40, 60, 40, 60, 140] : [90]);
  }, [flash]);

  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.id}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[65]"
          style={{ boxShadow: STYLES[flash.kind] }}
          initial={{ opacity: 0 }}
          animate={{ opacity: flash.kind === "win" ? [0, 1, 0.35, 1, 0] : [0, 1, 0] }}
          transition={{ duration: flash.kind === "win" ? 1.8 : 1.4, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}
