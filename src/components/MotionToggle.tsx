"use client";

// Bouton « animations » de l'en-tête : le joueur choisit lui-même entre
// animations complètes et animations réduites. Par défaut, le site suit le
// réglage de l'appareil ; si l'appareil les réduit, une pastille le signale.

import { motion } from "framer-motion";
import { setReducedMotion, systemPrefersReduced, useReducedMotionPref } from "@/lib/motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function MotionToggle() {
  const reduced = useReducedMotionPref();
  const label = reduced ? "Activer les animations" : "Réduire les animations";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => {
            setReducedMotion(!reduced);
            // Recharge pour relancer proprement le défilement fluide, le curseur et l'intro
            window.location.reload();
          }}
          aria-label={label}
          aria-pressed={!reduced}
          className="relative grid size-10 place-items-center rounded-full text-haze transition-colors hover:bg-white/[0.05] hover:text-chalk"
        >
          {/* Trois points : en mouvement si les animations sont actives, immobiles sinon */}
          <span aria-hidden className="flex items-end gap-[3px]">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-[5px] rounded-full bg-current"
                animate={reduced ? { y: 0 } : { y: [0, -4, 0] }}
                transition={reduced ? { duration: 0 } : { duration: 0.9, repeat: Infinity, delay: i * 0.14, ease: "easeInOut" }}
              />
            ))}
          </span>
          {reduced && <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-ruby" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {reduced && systemPrefersReduced() && " (ton appareil demande des animations réduites)"}
      </TooltipContent>
    </Tooltip>
  );
}
