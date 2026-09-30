"use client";

// Tous les « fournisseurs » partagés par le site, placés une seule fois autour des pages.

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { useReducedMotion } from "@react-spring/web";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "./WalletProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  // React Spring : coupe ses animations si l'utilisateur a demandé
  // « moins d'animations » dans les réglages de son appareil.
  useReducedMotion();

  return (
    // Framer Motion : même règle d'accessibilité pour toutes ses animations
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={150}>
        <WalletProvider>{children}</WalletProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
