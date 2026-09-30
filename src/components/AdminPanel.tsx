"use client";

// Page d'administration : déployer le contrat, alimenter la banque, retirer
// des gains, mettre en pause. Chaque action est une transaction que TU signes
// dans Adena : le site ne peut rien faire sans ton accord.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ADENA_DOWNLOAD_URL, sendTransaction, type TxMessage } from "@/lib/adena";
import { config, GAS } from "@/lib/config";
import { formatGnot, UGNOT_PER_GNOT } from "@/lib/format";
import { estimateFee, fetchGameInfo, fetchHasSignedCLA, fetchPackageStatus, type GameInfo, type PackageStatus } from "@/lib/gno";
import { deployMessage, fundMessage, realmPathFor, setPausedMessage, withdrawMessage, type ContractFile } from "@/lib/gnodice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWallet } from "./WalletProvider";

type Notice = { kind: "error" | "success" | "info"; text: string } | null;

// Couleur de l'encadré selon le type de message.
const ALERT_VARIANT = { error: "destructive", success: "success", info: "info" } as const;

// Texte long sans espaces (adresses, chemins) : on autorise le retour à la ligne n'importe où.
const MONO = "font-mono text-[0.88rem] [overflow-wrap:anywhere]";

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
    <div className="mx-auto flex max-w-[820px] flex-col gap-6 pt-9">
      <section>
        <h1 className="gold-text mb-1.5 font-display text-4xl font-extrabold">Administration</h1>
        <p className="text-muted-foreground">
          Déploie le contrat GNO-DICE sur {config.chainName}, puis gère la banque du jeu. Chaque action est une transaction que tu
          valides dans Adena.
        </p>
        <p className={`${MONO} mt-2 text-muted-foreground`}>Contrat utilisé par le site : {config.realmPath}</p>
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

/** Carte avec un titre doré (même style que le reste du site). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">{children}</CardContent>
    </Card>
  );
}

function ConnectCard() {
  const wallet = useWallet();
  return (
    <Section title="Connexion">
      <p className="text-muted-foreground">Connecte le wallet Adena qui sera (ou qui est) propriétaire du contrat.</p>
      <div>
        {wallet.status === "no-extension" ? (
          <Button asChild>
            <a href={ADENA_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              Installer Adena
            </a>
          </Button>
        ) : wallet.wrongNetwork ? (
          <Button onClick={wallet.switchNetwork}>Passer sur {config.chainName}</Button>
        ) : (
          <Button onClick={wallet.connect} disabled={wallet.status === "connecting" || wallet.status === "checking"}>
            {wallet.status === "connecting" ? "Connexion…" : "Connecter Adena"}
          </Button>
        )}
      </div>
      {wallet.error && <Alert variant="destructive">{wallet.error}</Alert>}
    </Section>
  );
}

/** Liste « libellé : valeur » (sur deux colonnes, ou une seule sur mobile). */
function KeyValues({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-[18px] gap-y-0.5 text-[0.93rem] sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-2 [&_dd]:mb-2 [&_dd]:[overflow-wrap:anywhere] sm:[&_dd]:mb-0 [&_dt]:text-muted-foreground">
      {children}
    </dl>
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
    <Section title="1. Déployer le contrat">
      <KeyValues>
        <dt>Chemin du contrat</dt>
        <dd className={MONO}>{path}</dd>
        <dt>État</dt>
        <dd>
          {status === "unknown" && "vérification…"}
          {status === "absent" && "pas encore déployé"}
          {status === "inert" && <span className="text-primary">en attente d’activation par le réseau…</span>}
          {status === "live" && <span className="font-bold text-win">✔ actif</span>}
        </dd>
        <dt>Fichiers envoyés</dt>
        <dd>
          {files.map((f) => f.name).join(", ")} + gnomod.toml ({Math.round(totalSize / 1024)} Ko)
        </dd>
      </KeyValues>

      {!claSigned && (
        <Alert variant="destructive">
          Le réseau demande de signer le CLA (accord de contribution) avant de déployer. Ouvre{" "}
          <a href={`${config.gnowebUrl}/r/sys/cla`} target="_blank" rel="noreferrer">
            gno.land/r/sys/cla
          </a>{" "}
          et signe-le avec ce wallet.
        </Alert>
      )}

      {status === "absent" && path !== config.realmPath && (
        <Alert variant="info">
          ⚠️ Ce wallet n’est pas celui prévu pour le site (le site attend <span className={MONO}>{config.realmPath}</span>). Tu peux quand
          même déployer ici, mais il faudra ensuite définir la variable <code>NEXT_PUBLIC_GNODICE_REALM</code> sur Vercel. Pour éviter ça,
          change de compte dans Adena.
        </Alert>
      )}

      {status === "absent" && (
        <>
          <p className="text-muted-foreground">
            Coût estimé : environ 3,5 GNOT bloqués comme « dépôt de stockage » (le code occupe de la place sur la blockchain) + quelques
            centièmes de GNOT de frais.
          </p>
          <div>
            <Button onClick={deploy} disabled={busy || !claSigned}>
              {busy ? "Signature dans Adena…" : "Déployer le contrat"}
            </Button>
          </div>
        </>
      )}

      {status === "live" && path === config.realmPath && (
        <Alert variant="success">
          ✔ C’est le contrat utilisé par le site : rien à configurer. Pense à alimenter la banque ci-dessous pour que les joueurs puissent
          miser.
        </Alert>
      )}

      {status === "live" && path !== config.realmPath && (
        <Alert variant="info">
          <p>
            <strong>Dernière étape :</strong> pour que le site utilise ce contrat, ajoute cette variable sur Vercel (Settings → Environment
            Variables) puis redéploie le site :
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2.5">
            <code className="rounded bg-black/40 px-2 py-1 font-mono [overflow-wrap:anywhere]">NEXT_PUBLIC_GNODICE_REALM={path}</code>
            <Button variant="outline" size="sm" onClick={copyEnv}>
              {copied ? "Copié ✔" : "Copier le chemin"}
            </Button>
          </p>
        </Alert>
      )}

      {notice && <Alert variant={ALERT_VARIANT[notice.kind]}>{notice.text}</Alert>}
    </Section>
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
  const notFound = !!loadError && /not found/i.test(loadError);

  return (
    <Section title="2. Gérer la banque">
      <p className={`${MONO} text-muted-foreground`}>{path}</p>

      {loadError && !info && (
        <Alert variant={notFound ? "info" : "destructive"}>
          {notFound
            ? "Pas encore de contrat actif à ce chemin. Déploie-le ci-dessus : cette section se mettra à jour dès qu’il sera actif."
            : `Impossible de lire le contrat : ${loadError}`}
        </Alert>
      )}

      {info && (
        <>
          <KeyValues>
            <dt>Solde de la banque</dt>
            <dd className="gold-text font-bold">{formatGnot(info.bankroll)} GNOT</dd>
            <dt>Mise max acceptée</dt>
            <dd>{formatGnot(info.maxCoverableBet)} GNOT</dd>
            <dt>Propriétaire</dt>
            <dd className={MONO}>
              {info.owner} {isOwner && <span className="font-bold text-win">(toi)</span>}
            </dd>
            <dt>État du jeu</dt>
            <dd>{info.paused ? "⏸️ en pause" : "▶️ ouvert"}</dd>
          </KeyValues>

          <p className="text-muted-foreground">
            Pour accepter la mise maximale de 10 GNOT, la banque doit contenir au moins 40 GNOT (le joueur apporte sa mise, la banque
            complète pour payer 5×). Prévois plus pour supporter plusieurs gains d’affilée.
          </p>

          <div className="flex flex-col gap-[18px]">
            <AdminAction label="Alimenter la banque" htmlFor="fund">
              <AmountRow id="fund" value={fundGnot} onChange={setFundGnot}>
                <Button
                  disabled={busy !== null}
                  onClick={() => run("fund", fundMessage(address, fundGnot * UGNOT_PER_GNOT, path), `${fundGnot} GNOT ajoutés à la banque.`)}
                >
                  {busy === "fund" ? "…" : "Envoyer"}
                </Button>
              </AmountRow>
            </AdminAction>

            {isOwner ? (
              <>
                <AdminAction label="Retirer de la banque" htmlFor="withdraw">
                  <AmountRow id="withdraw" value={withdrawGnot} onChange={setWithdrawGnot}>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() =>
                        run("withdraw", withdrawMessage(address, withdrawGnot * UGNOT_PER_GNOT, path), `${withdrawGnot} GNOT retirés vers ton wallet.`)
                      }
                    >
                      {busy === "withdraw" ? "…" : "Retirer"}
                    </Button>
                  </AmountRow>
                </AdminAction>
                <AdminAction label="Pause du jeu">
                  <Button
                    variant="outline"
                    className="self-start"
                    disabled={busy !== null}
                    onClick={() =>
                      run("pause", setPausedMessage(address, !info.paused, path), info.paused ? "Le jeu est relancé." : "Le jeu est en pause.")
                    }
                  >
                    {busy === "pause" ? "…" : info.paused ? "Relancer le jeu" : "Mettre en pause"}
                  </Button>
                </AdminAction>
              </>
            ) : (
              <Alert variant="info">Seul le propriétaire du contrat peut retirer des fonds ou mettre le jeu en pause.</Alert>
            )}
          </div>
        </>
      )}

      {notice && <Alert variant={ALERT_VARIANT[notice.kind]}>{notice.text}</Alert>}
    </Section>
  );
}

function AdminAction({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="font-semibold">
          {label}
        </label>
      ) : (
        <p className="font-semibold">{label}</p>
      )}
      {children}
    </div>
  );
}

/** Champ « montant en GNOT » (nombre entier ≥ 1) suivi d'un bouton. */
function AmountRow({ id, value, onChange, children }: { id: string; value: number; onChange: (v: number) => void; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Input
        id={id}
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.round(Number(e.target.value) || 1)))}
        className="w-[110px]"
      />
      <span>GNOT</span>
      {children}
    </div>
  );
}
