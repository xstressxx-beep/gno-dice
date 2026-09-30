"use client";

// Lit régulièrement l'état du jeu dans le contrat : banque, statistiques,
// et (si un wallet est connecté) le cooldown et les 10 dernières parties du joueur.

import { useCallback, useEffect, useState } from "react";
import { config } from "@/lib/config";
import { fetchGameInfo, fetchPackageStatus, fetchPlayer, type GameInfo, type PlayerInfo } from "@/lib/gno";

const REFRESH_EVERY_MS = 15_000;

/**
 * État du contrat sur la blockchain :
 * - loading     : première lecture en cours
 * - live        : contrat actif, le jeu fonctionne
 * - absent      : pas encore déployé à ce chemin
 * - inert       : déployé, en attente d'activation par le réseau
 * - unreachable : le réseau ne répond pas (ou erreur inattendue)
 */
export type ContractStatus = "loading" | "live" | "absent" | "inert" | "unreachable";

export type GnodiceData = {
  info: GameInfo | null;
  player: PlayerInfo | null;
  status: ContractStatus;
  loading: boolean;
  error: string | null;
  /** Décalage (en secondes) entre l'heure de la blockchain et l'horloge de l'ordinateur. */
  clockOffset: number;
  /** Relit les données tout de suite. Renvoie les nouvelles données du joueur. */
  refresh: () => Promise<PlayerInfo | null>;
};

type Snapshot = { info: GameInfo; player: PlayerInfo | null; readAt: number };
type Failure = { message: string; status: ContractStatus };

/** Lit en une fois les infos du jeu et celles du joueur. */
async function loadSnapshot(address: string | null): Promise<Snapshot> {
  const [info, player] = await Promise.all([fetchGameInfo(), address ? fetchPlayer(address) : Promise.resolve(null)]);
  return { info, player, readAt: Date.now() / 1000 };
}

/** Quand la lecture échoue, on demande au réseau si le contrat existe. */
async function diagnose(e: unknown): Promise<Failure> {
  const message = e instanceof Error ? e.message : String(e);
  try {
    const meta = await fetchPackageStatus(config.realmPath);
    if (meta.status === "absent" || meta.status === "inert") return { message, status: meta.status };
  } catch {
    // réseau injoignable : on garde "unreachable"
  }
  return { message, status: "unreachable" };
}

export function useGnodice(address: string | null): GnodiceData {
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [status, setStatus] = useState<ContractStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  const apply = useCallback((snap: Snapshot) => {
    setInfo(snap.info);
    setPlayer(snap.player);
    setClockOffset(snap.info.now - snap.readAt);
    setStatus("live");
    setError(null);
  }, []);

  const fail = useCallback((failure: Failure) => {
    setError(failure.message);
    // Si le contrat était déjà affiché, une panne réseau passagère ne l'efface pas.
    setStatus((prev) => (prev === "live" && failure.status === "unreachable" ? "live" : failure.status));
  }, []);

  // Lecture immédiate, puis toutes les 15 secondes.
  useEffect(() => {
    let cancelled = false;
    const update = () => {
      loadSnapshot(address).then(
        (snap) => !cancelled && apply(snap),
        (e) => diagnose(e).then((f) => !cancelled && fail(f)),
      );
    };
    update();
    const timer = setInterval(() => {
      // Pas besoin d'interroger le réseau si l'onglet est caché.
      if (document.visibilityState === "visible") update();
    }, REFRESH_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [address, apply, fail]);

  const refresh = useCallback(async (): Promise<PlayerInfo | null> => {
    try {
      const snap = await loadSnapshot(address);
      apply(snap);
      return snap.player;
    } catch (e) {
      fail(await diagnose(e));
      return null;
    }
  }, [address, apply, fail]);

  // Quand le joueur change (autre wallet), on n'affiche pas l'historique de l'ancien.
  const shownPlayer = player && player.address === address ? player : null;

  return { info, player: shownPlayer, status, loading: status === "loading", error, clockOffset, refresh };
}
