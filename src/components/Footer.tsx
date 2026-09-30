import Link from "next/link";
import { config } from "@/lib/config";

export function Footer() {
  const isTestnet = config.chainId !== "gnoland-1";
  return (
    <footer className="relative mt-12 border-t border-primary/10 bg-black/60 text-sm text-muted-foreground">
      <div className="gold-rule absolute inset-x-0 top-0" />
      <div className="page-container flex flex-col gap-2.5 py-7">
        <p>
          🎲 <span className="font-display font-bold tracking-wider text-primary">GNO-DICE</span> · jeu décentralisé sur{" "}
          <a href={config.gnowebUrl} target="_blank" rel="noreferrer">
            Gno.land
          </a>
          {isTestnet && <> · réseau de test : les GNOT n’ont pas de valeur réelle</>}
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          {config.faucetUrl && (
            <a href={config.faucetUrl} target="_blank" rel="noreferrer">
              Faucet GNOT
            </a>
          )}
          <a href="https://adena.app" target="_blank" rel="noreferrer">
            Wallet Adena
          </a>
          <Link href="/admin">Admin</Link>
        </p>
        <p className="text-xs opacity-80">Joue de façon responsable : ne mise jamais plus que ce que tu es prêt à perdre.</p>
      </div>
    </footer>
  );
}
