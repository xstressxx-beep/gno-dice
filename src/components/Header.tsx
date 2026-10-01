"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { config } from "@/lib/config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Die } from "./Die";
import { WalletButton } from "./WalletButton";

/**
 * Barre du haut : logo, réseau et wallet.
 * - elle se cache quand on descend et revient dès qu'on remonte (Framer Motion)
 * - elle devient plus opaque une fois la page défilée
 * - un filet doré en bas indique la progression dans la page
 */
export function Header() {
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0;
    setHidden(y > previous && y > 240);
    setScrolled(y > 12);
  });

  return (
    <motion.header
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-500 ${
        scrolled ? "border-white/[0.06] bg-black/75" : "border-transparent bg-black/20"
      }`}
    >
      <div className="page-container flex h-16 items-center justify-between gap-3 sm:h-[72px]">
        <Link href="/" aria-label="GNO-DICE, accueil" className="group flex shrink-0 items-center gap-2.5 hover:no-underline">
          <Die
            value={5}
            size={30}
            variant="gold"
            className="drop-shadow-[0_0_10px_rgba(245,197,66,0.45)] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[360deg] group-active:scale-90"
          />
          <span className="font-display text-base font-extrabold tracking-[0.2em] text-gold-100 transition-colors group-hover:text-gold-200 sm:text-lg">
            GNO-DICE
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden cursor-default items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#a39c8c] md:inline-flex">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-win opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-win" />
                </span>
                {config.chainName}
              </span>
            </TooltipTrigger>
            <TooltipContent>Réseau : {config.chainId}</TooltipContent>
          </Tooltip>
          <span data-magnetic="0.2" className="inline-flex min-w-0">
            <WalletButton />
          </span>
        </div>
      </div>
      {/* Progression dans la page */}
      <motion.div style={{ scaleX: progress }} className="absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-gold-600 via-gold-300 to-gold-100" />
    </motion.header>
  );
}
