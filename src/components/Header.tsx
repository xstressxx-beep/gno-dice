import Link from "next/link";
import { config } from "@/lib/config";
import { Die } from "./Die";
import { WalletButton } from "./WalletButton";
import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.logo} aria-label="GNO-DICE, accueil">
          <Die value={5} size={34} variant="gold" />
          <span className={`${styles.logoText} gold-text`}>GNO-DICE</span>
        </Link>
        <div className={styles.right}>
          <span className={styles.network} title={`Réseau : ${config.chainId}`}>
            <span className={styles.dot} aria-hidden />
            {config.chainName}
          </span>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
