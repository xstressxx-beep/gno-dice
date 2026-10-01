"use client";

// Bouton de connexion au wallet Adena, en haut à droite.
// Chaque état (vérification, connexion, connecté…) a sa propre apparence et
// on passe de l'un à l'autre avec une animation Framer Motion (AnimatePresence).
// Une fois connecté : avatar coloré, solde animé (React Spring) et un menu
// déroulant (Radix UI) pour copier l'adresse ou se déconnecter.

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, Download, Droplets, Loader2, LogOut, RefreshCw, Wallet } from "lucide-react";
import { ADENA_DOWNLOAD_URL } from "@/lib/adena";
import { config } from "@/lib/config";
import { addressHues, formatGnot, shortAddress } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "./AnimatedNumber";
import { useWallet } from "./WalletProvider";

type View = "checking" | "no-extension" | "disconnected" | "connecting" | "wrong-network" | "connected";

export function WalletButton() {
  const t = useTranslations("wallet");
  const { status, address, wrongNetwork, connect, switchNetwork } = useWallet();

  let view: View = status === "connected" ? "disconnected" : status;
  if (status === "connected" && address) view = wrongNetwork ? "wrong-network" : "connected";

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        className="flex min-w-0"
        initial={{ opacity: 0, scale: 0.85, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 6 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        {view === "checking" && <Skeleton className="h-10 w-32 rounded-full sm:w-40" aria-label={t("searching")} />}

        {view === "no-extension" && (
          <Button asChild>
            <a href={ADENA_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              <Download /> {t("install")}
            </a>
          </Button>
        )}

        {view === "disconnected" && (
          <Button onClick={connect} className="group overflow-hidden">
            {/* Reflet qui passe sur le bouton */}
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <Wallet className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
            <span className="hidden sm:inline">{t("connect")}</span>
            <span className="sm:hidden">{t("connectShort")}</span>
          </Button>
        )}

        {view === "connecting" && <ConnectingPill />}

        {view === "wrong-network" && (
          <Button variant="casino" onClick={switchNetwork} className="font-sans normal-case tracking-normal">
            <RefreshCw /> {t("switchNetwork")}
          </Button>
        )}

        {view === "connected" && address && <AccountMenu address={address} />}
      </motion.div>
    </AnimatePresence>
  );
}

/** Pendant la connexion : un anneau doré tourne autour du bouton. */
function ConnectingPill() {
  const t = useTranslations("wallet");
  return (
    <div className="relative h-10 overflow-hidden rounded-full p-px" role="status">
      <motion.span
        aria-hidden
        className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,#E3173E_70deg,#EFEADF_110deg,transparent_180deg)]"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      />
      <span className="relative flex h-full items-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-primary">
        <Loader2 className="size-4 animate-spin" />
        {t("connecting")}
      </span>
    </div>
  );
}

/** Wallet connecté : avatar + solde + adresse, avec un menu au clic. */
function AccountMenu({ address }: { address: string }) {
  const t = useTranslations("wallet");
  const locale = useLocale();
  const { balance, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [h1, h2] = addressHues(address);
  const isTestnet = config.chainId !== "gnoland-1";

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // presse-papiers refusé : l'adresse reste lisible dans le menu
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group relative flex h-10 min-w-0 items-center gap-2 rounded-full border border-primary/35 bg-lapis-950/50 py-1 pl-1 pr-2.5 text-sm transition-colors hover:border-primary/70 hover:bg-accent/60 data-[state=open]:border-primary/80"
          aria-label={t("menu", { address: shortAddress(address) })}
        >
          {/* Onde dorée une seule fois, à la connexion */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary"
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.35 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
          <span
            aria-hidden
            className="size-8 shrink-0 rounded-full border border-chalk-300/60 shadow-none"
            style={{ background: `conic-gradient(from 120deg, hsl(${h1} 80% 55%), hsl(${h2} 85% 45%), hsl(${h1} 80% 55%))` }}
          />
          <span className="font-bold text-primary tabular-nums">
            {balance === null ? "…" : <AnimatedNumber value={balance} format={(n) => formatGnot(n, 2, locale)} />}
            <span className="ml-1 text-xs font-semibold text-muted-foreground">GNOT</span>
          </span>
          <span className="hidden border-l border-primary/20 pl-2 font-mono text-xs text-foreground/80 sm:inline" title={address}>
            {shortAddress(address)}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          <span className="flex items-center gap-1.5 text-win">
            <span className="size-1.5 rounded-full bg-win" /> {t("connectedWith")}
          </span>
          <span className="mt-1.5 block break-all font-mono text-[0.7rem] leading-relaxed text-foreground/80">{address}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault(); // garde le menu ouvert pour voir « Copiée »
            copyAddress();
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? t("copied") : t("copy")}
        </DropdownMenuItem>
        {isTestnet && config.faucetUrl && (
          <DropdownMenuItem asChild>
            <a href={config.faucetUrl} target="_blank" rel="noreferrer">
              <Droplets /> {t("faucet")}
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={disconnect} className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive">
          <LogOut /> {t("disconnect")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
