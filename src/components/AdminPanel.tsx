"use client";

// Page d'administration : déployer le contrat, alimenter la banque, retirer
// des gains, mettre en pause. Chaque action est une transaction que TU signes
// dans Adena : le site ne peut rien faire sans ton accord.

import { useCallback, useEffect, useState } from "react";
import { ADENA_DOWNLOAD_URL, sendTransaction, type TxMessage } from "@/lib/adena";
import { config, GAS } from "@/lib/config";
import { formatGnot, UGNOT_PER_GNOT } from "@/lib/format";
import { estimateFee, fetchGameInfo, fetchHasSignedCLA, fetchPackageStatus, type GameInfo, type PackageStatus } from "@/lib/gno";
import { deployMessage, fundMessage, realmPathFor, setPausedMessage, withdrawMessage, type ContractFile } from "@/lib/gnodice";
import { useWallet } from "./WalletProvider";
import styles from "./AdminPanel.module.css";

type Notice = { kind: "error" | "success" | "info"; text: string } | null;

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function AdminPanel({ files }: { files: ContractFile[] }) {
  const wallet = useWallet();
  const [livePath, setLivePath] = useState<string | null>(null);
  const ready = wallet.status === "connected" && !wallet.wrongNetwork && wallet.address;
  // Le contrat utilisé par le site, et celui que ce wallet vient de déployer s'il est différent.
  const managedPaths = [config.realmPath, livePath].filter((p, i, all): p is string => !!p && all.indexOf(p) === i);

  return (
    <div className={styles.wrap}>
      <section className={styles.intro}>
        <h1 className="gold-text">Administration</h1>
        <p className="muted">
          Déploie le contrat GNO-DICE sur {config.chainName}, puis gère la banque du jeu. Chaque action est une transaction que tu
          valides dans Adena.
        </p>
        <p className={`${styles.mono} muted`} style={{ marginTop: 8 }}>
          Contrat utilisé par le site : {config.realmPath}
        </p>
      </section>

      {!ready ? (
        <ConnectCard />
      ) : (
        <>
          <DeploySection address={wallet.address!} files={files} onLive={setLivePath} />
          {managedPaths.map((path) => (
            <ManageSection key={path} address={wallet.address!} path={path} />
          ))}
        </>
      )}
    </div>
  );
}

function ConnectCard() {
  const wallet = useWallet();
  return (
    <section className="card">
      <h2 className="card-title">Connexion</h2>
      <p className="muted" style={{ marginBottom: 14 }}>
        Connecte le wallet Adena qui sera (ou qui est) propriétaire du contrat.
      </p>
      {wallet.status === "no-extension" ? (
        <a className="btn btn-gold" href={ADENA_DOWNLOAD_URL} target="_blank" rel="noreferrer">
          Installer Adena
        </a>
      ) : wallet.wrongNetwork ? (
        <button className="btn btn-gold" onClick={wallet.switchNetwork}>
          Passer sur {config.chainName}
        </button>
      ) : (
        <button className="btn btn-gold" onClick={wallet.connect} disabled={wallet.status === "connecting" || wallet.status === "checking"}>
          {wallet.status === "connecting" ? "Connexion…" : "Connecter Adena"}
        </button>
      )}
      {wallet.error && <p className="notice notice-error" style={{ marginTop: 14 }}>{wallet.error}</p>}
    </section>
  );
}

// --- Déploiement ---

function DeploySection({ address, files, onLive }: { address: string; files: ContractFile[]; onLive: (path: string) => void }) {
  const wallet = useWallet();
  const path = realmPathFor(address);
  const [status, setStatus] = useState<PackageStatus | "unknown">("unknown");
  const [claSigned, setClaSigned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [copied, setCopied] = useState(false);

  const applyStatus = useCallback(
    (s: PackageStatus) => {
      setStatus(s);
      if (s === "live") onLive(path);
    },
    [path, onLive],
  );

  const check = useCallback(async (): Promise<PackageStatus | "unknown"> => {
    try {
      const meta = await fetchPackageStatus(path);
      applyStatus(meta.status);
      return meta.status;
    } catch (e) {
      setNotice({ kind: "error", text: `Impossible de vérifier le contrat : ${errorText(e)}` });
      return "unknown";
    }
  }, [path, applyStatus]);

  // Au chargement : état du contrat et du CLA pour ce wallet.
  useEffect(() => {
    let cancelled = false;
    fetchPackageStatus(path).then(
      (meta) => !cancelled && applyStatus(meta.status),
      (e) => !cancelled && setNotice({ kind: "error", text: `Impossible de vérifier le contrat : ${errorText(e)}` }),
    );
    fetchHasSignedCLA(address).then((ok) => !cancelled && setClaSigned(ok));
    return () => {
      cancelled = true;
    };
  }, [path, address, applyStatus]);

  // Après l'envoi, le réseau vérifie le contrat avant de l'activer : on surveille.
  useEffect(() => {
    if (!waiting && status !== "inert") return;
    const timer = setInterval(async () => {
      const s = await check();
      if (s === "live") {
        setWaiting(false);
        setNotice({ kind: "success", text: "Contrat actif sur la blockchain !" });
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting, status, check]);

  async function deploy() {
    setBusy(true);
    setNotice(null);
    try {
      const fee = await estimateFee(GAS.deploy);
      await sendTransaction([deployMessage(address, files)], GAS.deploy, fee);
      wallet.refreshBalance();
      if ((await check()) === "live") {
        setNotice({ kind: "success", text: "Contrat actif sur la blockchain !" });
      } else {
        setNotice({ kind: "info", text: "Contrat envoyé ! Le réseau le vérifie avant de l’activer (souvent moins d’une minute)…" });
        setWaiting(true);
      }
    } catch (e) {
      setNotice({ kind: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function copyEnv() {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // presse-papiers refusé : l'utilisateur peut copier à la main
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.body.length, 0);

  return (
    <section className="card">
      <h2 className="card-title">1. Déployer le contrat</h2>
      <dl className={styles.kv}>
        <dt>Chemin du contrat</dt>
        <dd className={styles.mono}>{path}</dd>
        <dt>État</dt>
        <dd>
          {status === "unknown" && "vérification…"}
          {status === "absent" && "pas encore déployé"}
          {status === "inert" && <span className={styles.pending}>en attente d’activation par le réseau…</span>}
          {status === "live" && <span className={styles.ok}>✔ actif</span>}
        </dd>
        <dt>Fichiers envoyés</dt>
        <dd>
          {files.map((f) => f.name).join(", ")} + gnomod.toml ({Math.round(totalSize / 1024)} Ko)
        </dd>
      </dl>

      {!claSigned && (
        <p className="notice notice-error">
          Le réseau demande de signer le CLA (accord de contribution) avant de déployer. Ouvre{" "}
          <a href={`${config.gnowebUrl}/r/sys/cla`} target="_blank" rel="noreferrer">
            gno.land/r/sys/cla
          </a>{" "}
          et signe-le avec ce wallet.
        </p>
      )}

      {status === "absent" && path !== config.realmPath && (
        <p className="notice notice-info" style={{ marginTop: 14 }}>
          ⚠️ Ce wallet n’est pas celui prévu pour le site (le site attend <span className={styles.mono}>{config.realmPath}</span>). Tu
          peux quand même déployer ici, mais il faudra ensuite définir la variable <code>NEXT_PUBLIC_GNODICE_REALM</code> sur Vercel. Pour
          éviter ça, change de compte dans Adena.
        </p>
      )}

      {status === "absent" && (
        <>
          <p className="muted" style={{ margin: "14px 0" }}>
            Coût estimé : environ 3,5 GNOT bloqués comme « dépôt de stockage » (le code occupe de la place sur la blockchain) + quelques
            centièmes de GNOT de frais.
          </p>
          <button className="btn btn-gold" onClick={deploy} disabled={busy || !claSigned}>
            {busy ? "Signature dans Adena…" : "Déployer le contrat"}
          </button>
        </>
      )}

      {status === "live" && path === config.realmPath && (
        <p className="notice notice-success" style={{ marginTop: 14 }}>
          ✔ C’est le contrat utilisé par le site : rien à configurer. Pense à alimenter la banque ci-dessous pour que les joueurs
          puissent miser.
        </p>
      )}

      {status === "live" && path !== config.realmPath && (
        <div className="notice notice-info" style={{ marginTop: 14 }}>
          <p>
            <strong>Dernière étape :</strong> pour que le site utilise ce contrat, ajoute cette variable sur Vercel (Settings → Environment
            Variables) puis redéploie le site :
          </p>
          <p className={styles.envLine}>
            <code>NEXT_PUBLIC_GNODICE_REALM={path}</code>
            <button className="btn btn-small" onClick={copyEnv}>
              {copied ? "Copié ✔" : "Copier le chemin"}
            </button>
          </p>
        </div>
      )}

      {notice && <p className={`notice notice-${notice.kind}`} style={{ marginTop: 14 }}>{notice.text}</p>}
    </section>
  );
}

// --- Gestion de la banque ---

function ManageSection({ address, path }: { address: string; path: string }) {
  const wallet = useWallet();
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fundGnot, setFundGnot] = useState(50);
  const [withdrawGnot, setWithdrawGnot] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await fetchGameInfo(path));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    const readInfo = () =>
      fetchGameInfo(path).then(
        (i) => {
          if (cancelled) return;
          setInfo(i);
          setLoadError(null);
        },
        (e) => !cancelled && setLoadError(errorText(e)),
      );
    readInfo();
    // Tant que le contrat n'est pas lisible (déploiement en cours), on réessaie.
    const timer = setInterval(() => {
      if (!cancelled) readInfo();
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [path]);

  async function run(label: string, message: TxMessage, success: string) {
    setBusy(label);
    setNotice(null);
    try {
      const fee = await estimateFee(GAS.admin);
      await sendTransaction([message], GAS.admin, fee);
      // On relit la banque AVANT d'afficher le succès, pour montrer le nouveau solde.
      await load();
      wallet.refreshBalance();
      setNotice({ kind: "success", text: success });
    } catch (e) {
      setNotice({ kind: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  }

  const isOwner = info?.owner === address;

  return (
    <section className="card">
      <h2 className="card-title">2. Gérer la banque</h2>
      <p className={`${styles.mono} muted`} style={{ marginBottom: 14 }}>
        {path}
      </p>

      {loadError && !info && (
        <p className={`notice ${/not found/i.test(loadError) ? "notice-info" : "notice-error"}`}>
          {/not found/i.test(loadError)
            ? "Pas encore de contrat actif à ce chemin. Déploie-le ci-dessus : cette section se mettra à jour dès qu’il sera actif."
            : `Impossible de lire le contrat : ${loadError}`}
        </p>
      )}

      {info && (
        <>
          <dl className={styles.kv}>
            <dt>Solde de la banque</dt>
            <dd className="gold-text">{formatGnot(info.bankroll)} GNOT</dd>
            <dt>Mise max acceptée</dt>
            <dd>{formatGnot(info.maxCoverableBet)} GNOT</dd>
            <dt>Propriétaire</dt>
            <dd className={styles.mono}>
              {info.owner} {isOwner && <span className={styles.ok}>(toi)</span>}
            </dd>
            <dt>État du jeu</dt>
            <dd>{info.paused ? "⏸️ en pause" : "▶️ ouvert"}</dd>
          </dl>

          <p className="muted" style={{ margin: "14px 0" }}>
            Pour accepter la mise maximale de 10 GNOT, la banque doit contenir au moins 40 GNOT (le joueur apporte sa mise, la banque
            complète pour payer 5×). Prévois plus pour supporter plusieurs gains d’affilée.
          </p>

          <div className={styles.actions}>
            <div className={styles.action}>
              <label htmlFor="fund">Alimenter la banque</label>
              <div className={styles.inputRow}>
                <input id="fund" type="number" min={1} step={1} value={fundGnot} onChange={(e) => setFundGnot(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
                <span>GNOT</span>
                <button
                  className="btn btn-gold"
                  disabled={busy !== null}
                  onClick={() => run("fund", fundMessage(address, fundGnot * UGNOT_PER_GNOT, path), `${fundGnot} GNOT ajoutés à la banque.`)}
                >
                  {busy === "fund" ? "…" : "Envoyer"}
                </button>
              </div>
            </div>

            {isOwner ? (
              <>
                <div className={styles.action}>
                  <label htmlFor="withdraw">Retirer de la banque</label>
                  <div className={styles.inputRow}>
                    <input id="withdraw" type="number" min={1} step={1} value={withdrawGnot} onChange={(e) => setWithdrawGnot(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
                    <span>GNOT</span>
                    <button
                      className="btn"
                      disabled={busy !== null}
                      onClick={() => run("withdraw", withdrawMessage(address, withdrawGnot * UGNOT_PER_GNOT, path), `${withdrawGnot} GNOT retirés vers ton wallet.`)}
                    >
                      {busy === "withdraw" ? "…" : "Retirer"}
                    </button>
                  </div>
                </div>
                <div className={styles.action}>
                  <label>Pause du jeu</label>
                  <button
                    className="btn"
                    disabled={busy !== null}
                    onClick={() =>
                      run("pause", setPausedMessage(address, !info.paused, path), info.paused ? "Le jeu est relancé." : "Le jeu est en pause.")
                    }
                  >
                    {busy === "pause" ? "…" : info.paused ? "Relancer le jeu" : "Mettre en pause"}
                  </button>
                </div>
              </>
            ) : (
              <p className="notice notice-info">Seul le propriétaire du contrat peut retirer des fonds ou mettre le jeu en pause.</p>
            )}
          </div>
        </>
      )}

      {notice && <p className={`notice notice-${notice.kind}`} style={{ marginTop: 14 }}>{notice.text}</p>}
    </section>
  );
}
