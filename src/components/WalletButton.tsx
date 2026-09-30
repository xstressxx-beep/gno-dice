"use client";

import { ADENA_DOWNLOAD_URL } from "@/lib/adena";
import { formatGnot, shortAddress } from "@/lib/format";
import { useWallet } from "./WalletProvider";
import styles from "./WalletButton.module.css";

/** Bouton de connexion au wallet Adena, affiché en haut à droite. */
export function WalletButton() {
  const { status, address, balance, wrongNetwork, connect, disconnect, switchNetwork } = useWallet();

  if (status === "checking") {
    return (
      <button className="btn" disabled>
        Adena…
      </button>
    );
  }

  if (status === "no-extension") {
    return (
      <a className="btn btn-gold" href={ADENA_DOWNLOAD_URL} target="_blank" rel="noreferrer">
        Installer Adena
      </a>
    );
  }

  if (status !== "connected" || !address) {
    return (
      <button className="btn btn-gold" onClick={connect} disabled={status === "connecting"}>
        {status === "connecting" ? "Connexion…" : "Connecter Adena"}
      </button>
    );
  }

  if (wrongNetwork) {
    return (
      <button className="btn btn-gold" onClick={switchNetwork}>
        Changer de réseau
      </button>
    );
  }

  return (
    <div className={styles.account}>
      <span className={styles.balance}>{balance === null ? "…" : `${formatGnot(balance)} GNOT`}</span>
      <span className={styles.address} title={address}>
        {shortAddress(address)}
      </span>
      <button className={styles.logout} onClick={disconnect} aria-label="Déconnecter le wallet" title="Déconnecter">
        ×
      </button>
    </div>
  );
}
