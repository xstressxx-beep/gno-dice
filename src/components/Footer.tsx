import Link from "next/link";
import { config } from "@/lib/config";

export function Footer() {
  const isTestnet = config.chainId !== "gnoland-1";
  return (
    <footer className="mt-auto border-t border-border text-sm text-haze">
      <div className="page-container flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="display-soft text-3xl leading-none text-chalk">gnodice</p>
          <p className="max-w-[48ch]">
            Un jeu de dés décentralisé sur{" "}
            <a href={config.gnowebUrl} target="_blank" rel="noreferrer">
              Gno.land
            </a>
            .{isTestnet && " Réseau de test : les GNOT n’ont pas de valeur réelle."} Joue de façon responsable : ne mise jamais plus que ce que tu es
            prêt à perdre.
          </p>
        </div>
        <nav aria-label="Liens utiles" className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#comment-ca-marche">Comment ça marche</a>
          {config.faucetUrl && (
            <a href={config.faucetUrl} target="_blank" rel="noreferrer">
              GNOT gratuits
            </a>
          )}
          <a href="https://adena.app" target="_blank" rel="noreferrer">
            Wallet Adena
          </a>
          <Link href="/admin">Administration</Link>
        </nav>
      </div>
    </footer>
  );
}
