"use client";

// Tous les « fournisseurs » partagés par le site, placés une seule fois autour des pages.

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { Globals } from "@react-spring/web";
import { useReducedMotionPref } from "@/lib/motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "./WalletProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionPref();

  // React Spring : animations coupées si le joueur a choisi « animations réduites »
  useEffect(() => {
    Globals.assign({ skipAnimation: reduced });
  }, [reduced]);

  return (
    // Framer Motion : même règle pour toutes ses animations
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <TooltipProvider delayDuration={150}>
        <WalletProvider>{children}</WalletProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
