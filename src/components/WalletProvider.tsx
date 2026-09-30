"use client";

// Garde en mémoire l'état du wallet Adena (connecté ou non, adresse, réseau,
// solde) et le partage avec tous les composants du site.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { connectWallet, getAccount, getAdena, onWalletChange, switchToSiteNetwork, WalletError } from "@/lib/adena";
import { config } from "@/lib/config";
import { fetchBalance } from "@/lib/gno";

type Status = "checking" | "no-extension" | "disconnected" | "connecting" | "connected";

type WalletContextValue = {
  status: Status;
  address: string | null;
  chainId: string | null;
  /** true si Adena est connecté à un autre réseau que celui du site */
  wrongNetwork: boolean;
  /** solde en ugnot sur le réseau du site */
  balance: number | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  refreshBalance: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

// Mémorise (dans le navigateur) que l'utilisateur s'est déjà connecté, pour le
// reconnecter automatiquement sans fenêtre Adena au prochain chargement.
const STORAGE_KEY = "gnodice:connected";

function rememberConnection(value: boolean) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // stockage indisponible (navigation privée...) : pas grave
  }
}

function wasConnected(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    const account = await getAccount();
    setAddress(account.address);
    setChainId(account.chainId);
    setStatus("connected");
  }, []);

  const resetAccount = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setBalance(null);
    setStatus("disconnected");
  }, []);

  // Au chargement : détecter Adena et reconnecter l'utilisateur s'il l'était déjà.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const adena = await getAdena();
      if (cancelled) return;
      if (!adena) {
        setStatus("no-extension");
        return;
      }
      if (!wasConnected()) {
        setStatus("disconnected");
        return;
      }
      try {
        await loadAccount();
      } catch {
        if (!cancelled) resetAccount();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAccount, resetAccount]);

  // Si l'utilisateur change de compte ou de réseau dans Adena, on suit.
  useEffect(() => {
    if (status !== "connected") return;
    return onWalletChange(() => {
      loadAccount().catch(resetAccount);
    });
  }, [status, loadAccount, resetAccount]);

  const wrongNetwork = status === "connected" && chainId !== config.chainId;

  const refreshBalance = useCallback(async () => {
    if (!address || wrongNetwork) return;
    try {
      setBalance(await fetchBalance(address));
    } catch {
      // on garde l'ancien solde si le réseau ne répond pas
    }
  }, [address, wrongNetwork]);

  useEffect(() => {
    if (!address || wrongNetwork) return;
    let cancelled = false;
    fetchBalance(address)
      .then((b) => !cancelled && setBalance(b))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [address, wrongNetwork]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const account = await connectWallet();
      rememberConnection(true);
      setAddress(account.address);
      setChainId(account.chainId);
      setStatus("connected");
      // Mauvais réseau : on propose tout de suite de basculer.
      if (account.chainId !== config.chainId) {
        try {
          await switchToSiteNetwork();
          await loadAccount();
        } catch (e) {
          setError(messageOf(e));
        }
      }
    } catch (e) {
      if (e instanceof WalletError && e.code === "NO_EXTENSION") setStatus("no-extension");
      else setStatus("disconnected");
      setError(messageOf(e));
    }
  }, [loadAccount]);

  const switchNetwork = useCallback(async () => {
    setError(null);
    try {
      await switchToSiteNetwork();
      await loadAccount();
    } catch (e) {
      setError(messageOf(e));
    }
  }, [loadAccount]);

  const disconnect = useCallback(() => {
    // Adena ne permet pas à un site de se déconnecter lui-même : on oublie
    // simplement le compte de notre côté.
    rememberConnection(false);
    setError(null);
    resetAccount();
  }, [resetAccount]);

  const value = useMemo<WalletContextValue>(
    () => ({ status, address, chainId, wrongNetwork, balance, error, connect, disconnect, switchNetwork, refreshBalance }),
    [status, address, chainId, wrongNetwork, balance, error, connect, disconnect, switchNetwork, refreshBalance],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet doit être utilisé dans <WalletProvider>");
  return ctx;
}
