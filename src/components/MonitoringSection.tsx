"use client";

// Tableau de bord de surveillance (page /admin) :
// - indicateurs : banque (totale, réservée, disponible), gains du jour face au
//   coupe-circuit, parties en cours, taux de victoire et de retour réels
// - alertes calculées par lib/monitoring.ts (banque basse, croupier, parties
//   bloquées, taux de victoire anormal…)
// - réglages de sécurité (propriétaire) : croupier, limites, liste noire

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { sendTransaction, type TxMessage } from "@/lib/adena";
import { GAS } from "@/lib/config";
import { formatGnot, UGNOT_PER_GNOT } from "@/lib/format";
import { estimateFee, fetchGameInfo, fetchOpenGames, isValidAddress, type Game, type GameInfo } from "@/lib/gno";
import { setBlockedMessage, setCroupierMessage, setLimitsMessage } from "@/lib/gnodice";
import { computeAlerts, computeStats, type CroupierState, type MonitorAlert } from "@/lib/monitoring";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWallet } from "./WalletProvider";

const REFRESH_MS = 15_000;
const LEVEL_VARIANT = { critical: "destructive", warning: "info", info: "default" } as const;

export function MonitoringSection({ path }: { path: string }) {
  const wallet = useWallet();
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [open, setOpen] = useState<Game[]>([]);
  const [croupier, setCroupier] = useState<CroupierState>(null);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [i, o, c] = await Promise.all([
      fetchGameInfo(path).catch(() => null),
      fetchOpenGames(0, path).catch(() => [] as Game[]),
      fetch("/api/croupier/status", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<CroupierState>) : null))
        .catch(() => null),
    ]);
    setInfo(i);
    setOpen(o);
    setCroupier(c);
    setNow(Date.now() / 1000);
  }, [path]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (!info) return null;
  const isOwner = wallet.address === info.owner;
  const alerts = computeAlerts(info, croupier, open, now);
  const stats = computeStats(info);

  async function run(message: TxMessage, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      await sendTransaction([message], GAS.admin, await estimateFee(GAS.admin));
      await load();
      setNotice({ ok: true, text: success });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Surveillance et sécurité</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Kpi label="Banque totale">{formatGnot(info.bankroll)} GNOT</Kpi>
          <Kpi label="Réservée aux parties en cours">{formatGnot(info.reserved)} GNOT</Kpi>
          <Kpi label="Disponible">{formatGnot(info.available)} GNOT</Kpi>
          <Kpi label="Gains payés aujourd'hui">
            {formatGnot(info.payoutToday)} / {formatGnot(info.dailyPayoutLimit)} GNOT
          </Kpi>
          <Kpi label="Parties en cours">{info.openGames}</Kpi>
          <Kpi label="Remboursées / expirées">
            {info.totalRefunded} / {info.totalExpired}
          </Kpi>
          <Kpi label="Taux de victoire (attendu 16,7 %)">{stats.winRate === null ? "—" : `${(stats.winRate * 100).toFixed(1)} %`}</Kpi>
          <Kpi label="Taux de retour (attendu 83,3 %)">{stats.rtp === null ? "—" : `${(stats.rtp * 100).toFixed(1)} %`}</Kpi>
          <Kpi label="Parties terminées">{stats.settled}</Kpi>
        </dl>

        <div className="flex flex-col gap-2.5">
          <h3 className="font-semibold">Alertes</h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-haze">Aucune alerte. Tout fonctionne normalement.</p>
          ) : (
            alerts.map((a: MonitorAlert, i) => (
              <Alert key={i} variant={LEVEL_VARIANT[a.level]}>
                <p>
                  <strong>{a.title}.</strong> {a.detail}
                </p>
              </Alert>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <h3 className="text-base font-semibold">Croupier</h3>
          <p className="text-haze">
            Contrat : <span className="font-mono text-chalk">{info.croupier}</span>
          </p>
          {croupier?.configured && (
            <p className="text-haze">
              Serveur : <span className="font-mono text-chalk">{croupier.address}</span> ({croupier.balance >= 0 ? `${formatGnot(croupier.balance)} GNOT pour le gas` : "solde inconnu"})
            </p>
          )}
          {isOwner && croupier?.configured && croupier.activeOnContract === false && (
            <Button
              className="self-start"
              disabled={busy}
              onClick={() => run(setCroupierMessage(wallet.address!, croupier.address, path), "Le contrat utilise maintenant le croupier du serveur.")}
            >
              Utiliser ce croupier
            </Button>
          )}
        </div>

        {isOwner && <OwnerControls info={info} path={path} busy={busy} run={run} />}
        {notice && <Alert variant={notice.ok ? "success" : "destructive"}>{notice.text}</Alert>}
      </CardContent>
    </Card>
  );
}

function OwnerControls({ info, path, busy, run }: { info: GameInfo; path: string; busy: boolean; run: (m: TxMessage, s: string) => void }) {
  const wallet = useWallet();
  const [daily, setDaily] = useState(Math.round(info.dailyPayoutLimit / UGNOT_PER_GNOT));
  const [low, setLow] = useState(Math.round(info.lowBankroll / UGNOT_PER_GNOT));
  const [player, setPlayer] = useState("");
  const validPlayer = isValidAddress(player.trim());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Limites</h3>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Gains max par jour (GNOT)
            <Input type="number" min={50} value={daily} onChange={(e) => setDaily(Math.max(50, Math.round(Number(e.target.value) || 50)))} className="w-32" />
          </label>
          <label className="flex flex-col gap-1">
            Alerte banque basse (GNOT)
            <Input type="number" min={0} value={low} onChange={(e) => setLow(Math.max(0, Math.round(Number(e.target.value) || 0)))} className="w-32" />
          </label>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(setLimitsMessage(wallet.address!, daily * UGNOT_PER_GNOT, low * UGNOT_PER_GNOT, path), "Limites mises à jour.")}
          >
            Enregistrer
          </Button>
        </div>
        <p className="text-sm text-haze">Au-delà des gains max du jour, le jeu se met en pause tout seul (protection si le croupier est compromis).</p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Interdire ou réautoriser une adresse</h3>
        <div className="flex flex-wrap items-center gap-2.5">
          <Input value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="g1…" className="w-full max-w-sm font-mono" aria-label="Adresse du joueur" />
          <Button variant="outline" disabled={busy || !validPlayer} onClick={() => run(setBlockedMessage(wallet.address!, player.trim(), true, path), "Adresse interdite de jeu.")}>
            Interdire
          </Button>
          <Button variant="outline" disabled={busy || !validPlayer} onClick={() => run(setBlockedMessage(wallet.address!, player.trim(), false, path), "Adresse réautorisée.")}>
            Réautoriser
          </Button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-haze">{label}</dt>
      <dd className="mt-0.5 text-lg font-medium tabular-nums text-chalk">{children}</dd>
    </div>
  );
}
