"use client";

// Lit régulièrement l'état du jeu dans le contrat : banque, statistiques,
// et (si un wallet est connecté) le cooldown et les 10 dernières parties du joueur.

import { useCallback, useEffect, useState } from "react";
import { config } from "@/lib/config";
import { fetchGameInfo, fetchPlayer, type GameInfo, type PlayerInfo } from "@/lib/gno";

const REFRESH_EVERY_MS = 15_000;

export type GnodiceData = {
  info: GameInfo | null;
  player: PlayerInfo | null;
  loading: boolean;
  error: string | null;
  /** Décalage (en secondes) entre l'heure de la blockchain et l'horloge de l'ordinateur. */
  clockOffset: number;
  /** Relit les données tout de suite. Renvoie les nouvelles données du joueur. */
  refresh: () => Promise<PlayerInfo | null>;
};

type Snapshot = { info: GameInfo; player: PlayerInfo | null; readAt: number };

/** Lit en une fois les infos du jeu et celles du joueur. */
async function loadSnapshot(address: string | null): Promise<Snapshot> {
  const [info, player] = await Promise.all([fetchGameInfo(), address ? fetchPlayer(address) : Promise.resolve(null)]);
  return { info, player, readAt: Date.now() / 1000 };
}

export function useGnodice(address: string | null): GnodiceData {
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(config.realmPath));
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  const apply = useCallback((snap: Snapshot) => {
    setInfo(snap.info);
    setPlayer(snap.player);
    setClockOffset(snap.info.now - snap.readAt);
    setError(null);
    setLoading(false);
  }, []);

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setLoading(false);
  }, []);

  // Lecture immédiate, puis toutes les 15 secondes.
  useEffect(() => {
    if (!config.realmPath) return;
    let cancelled = false;
    const update = () => {
      loadSnapshot(address).then(
        (snap) => !cancelled && apply(snap),
        (e) => !cancelled && fail(e),
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
    if (!config.realmPath) return null;
    try {
      const snap = await loadSnapshot(address);
      apply(snap);
      return snap.player;
    } catch (e) {
      fail(e);
      return null;
    }
  }, [address, apply, fail]);

  // Quand le joueur change (autre wallet), on n'affiche pas l'historique de l'ancien.
  const shownPlayer = player && player.address === address ? player : null;

  return { info, player: shownPlayer, loading, error, clockOffset, refresh };
}
