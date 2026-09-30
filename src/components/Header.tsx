import Link from "next/link";
import { config } from "@/lib/config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Die } from "./Die";
import { WalletButton } from "./WalletButton";

/** Barre du haut, collée en haut de l'écran : logo, réseau et wallet. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-black/70 backdrop-blur-xl">
      <div className="page-container flex h-16 items-center justify-between gap-3 sm:h-[72px]">
        <Link href="/" aria-label="GNO-DICE, accueil" className="group flex shrink-0 items-center gap-2.5 hover:no-underline">
          <Die
            value={5}
            size={34}
            variant="gold"
            className="drop-shadow-[0_0_10px_rgba(245,197,66,0.45)] transition-transform duration-700 ease-out group-hover:rotate-[360deg]"
          />
          <span className="gold-text-animated font-display text-lg font-extrabold tracking-[0.16em] sm:text-2xl">GNO-DICE</span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden cursor-default items-center gap-2 rounded-full border border-primary/15 bg-black/40 px-3 py-1.5 text-xs text-muted-foreground md:inline-flex">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-win opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-win" />
                </span>
                {config.chainName}
              </span>
            </TooltipTrigger>
            <TooltipContent>Réseau : {config.chainId}</TooltipContent>
          </Tooltip>
          <WalletButton />
        </div>
      </div>
      {/* Filet doré sous l'en-tête */}
      <div className="gold-rule absolute inset-x-0 bottom-0" />
    </header>
  );
}
