"use client";

// « Retour haptique visuel » : les bords de l'écran s'illuminent brièvement,
// en or pour une victoire, en rouge pour une défaite (Framer Motion).
// Sur téléphone, on ajoute une vraie vibration quand l'appareil le permet.

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "@/lib/fx";

export type Flash = { kind: "win" | "lose"; id: number };

const COLORS = {
  win: "inset 0 0 140px 30px rgba(245,197,66,0.45), inset 0 0 0 2px rgba(253,231,161,0.5)",
  lose: "inset 0 0 120px 20px rgba(220,20,45,0.4), inset 0 0 0 2px rgba(239,51,70,0.45)",
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
    // Victoire : trois impulsions qui montent ; défaite : un choc sourd.
    haptic(flash.kind === "win" ? [40, 60, 40, 60, 120] : [90]);
  }, [flash]);

  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.id}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[65]"
          style={{ boxShadow: COLORS[flash.kind] }}
          initial={{ opacity: 0 }}
          animate={{ opacity: flash.kind === "win" ? [0, 1, 0.5, 1, 0] : [0, 1, 0] }}
          transition={{ duration: flash.kind === "win" ? 1.6 : 0.9, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}
