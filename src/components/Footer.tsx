import Link from "next/link";
import { config } from "@/lib/config";
import styles from "./Footer.module.css";

export function Footer() {
  const isTestnet = config.chainId !== "gnoland-1";
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>
          🎲 GNO-DICE · jeu décentralisé sur{" "}
          <a href={config.gnowebUrl} target="_blank" rel="noreferrer">
            Gno.land
          </a>
          {isTestnet && <> · réseau de test : les GNOT n’ont pas de valeur réelle</>}
        </p>
        <p className={styles.links}>
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
        <p className={styles.warning}>Joue de façon responsable : ne mise jamais plus que ce que tu es prêt à perdre.</p>
      </div>
    </footer>
  );
}
