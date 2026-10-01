"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { config } from "@/lib/config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MotionToggle } from "./MotionToggle";
import { WalletButton } from "./WalletButton";

/**
 * Barre du haut : logo, réseau et wallet.
 * - elle se cache quand on descend et revient dès qu'on remonte (Framer Motion)
 * - un filet rubis en bas indique la progression dans la page
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
      className={`sticky top-0 z-40 transition-colors duration-500 ${scrolled ? "bg-lapis/80 backdrop-blur-xl" : "bg-transparent"}`}
    >
      <div className="page-container flex h-16 items-center justify-between gap-3 sm:h-[72px]">
        <Link href="/" aria-label="GNO-DICE, accueil" className="group flex shrink-0 items-center gap-2.5 text-chalk no-underline hover:text-chalk hover:no-underline">
          {/* Le logo : un petit dé rubis qui fait un demi-tour au survol */}
          <span
            aria-hidden
            className="relative grid size-7 place-items-center rounded-[7px] bg-gradient-to-br from-ruby-light to-ruby-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_14px_-4px_rgba(227,23,62,0.6)] transition-transform duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[180deg] group-active:scale-90"
          >
            <span className="size-2 rounded-full bg-chalk-50" />
          </span>
          <span className="display-soft text-[1.6rem] leading-none tracking-[-0.03em]">gnodice</span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden cursor-default items-center gap-2 rounded-full px-3 py-1.5 text-sm text-haze md:inline-flex">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-signal" />
                </span>
                {config.chainName}
              </span>
            </TooltipTrigger>
            <TooltipContent>Réseau : {config.chainId}</TooltipContent>
          </Tooltip>
          <MotionToggle />
          <span data-magnetic="0.2" className="inline-flex min-w-0">
            <WalletButton />
          </span>
        </div>
      </div>
      {/* Progression dans la page */}
      <motion.div style={{ scaleX: progress }} className="absolute inset-x-0 bottom-0 h-px origin-left bg-ruby/70" />
    </motion.header>
  );
}
