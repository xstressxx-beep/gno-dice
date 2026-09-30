// Communication avec l'extension de navigateur Adena (le wallet Gno).
//
// Adena ajoute un objet `window.adena` dans la page. Le site ne voit jamais la
// clé privée : il demande à Adena de signer, et c'est toi qui acceptes ou
// refuses dans la fenêtre d'Adena.

import { config, SITE_NAME } from "./config";
import { fromBase64 } from "./gno";

// --- Types de l'API Adena (seulement ce qu'on utilise) ---

type AdenaResponse<T = unknown> = {
  code: number;
  status: "success" | "failure";
  type: string;
  message: string;
  data: T;
};

type AccountData = {
  address: string;
  coins: string;
  chainId: string;
  status?: string;
};

type TxResponseBase = {
  Error: unknown;
  Data: string | null;
  Log: string;
};

type TxResult = {
  hash?: string;
  height?: string | number;
  check_tx?: { ResponseBase?: TxResponseBase };
  deliver_tx?: { ResponseBase?: TxResponseBase };
};

export type TxMessage =
  | {
      type: "/vm.m_call";
      value: {
        caller: string;
        send: string;
        max_deposit: string;
        pkg_path: string;
        func: string;
        args: string[];
      };
    }
  | {
      type: "/vm.m_addpkg";
      value: {
        creator: string;
        send: string;
        max_deposit: string;
        package: {
          name: string;
          path: string;
          files: { name: string; body: string }[];
        };
      };
    };

type AdenaWallet = {
  AddEstablish(name: string): Promise<AdenaResponse>;
  GetAccount(): Promise<AdenaResponse<AccountData>>;
  SwitchNetwork(chainId: string): Promise<AdenaResponse>;
  AddNetwork(network: { chainId: string; chainName: string; rpcUrl: string }): Promise<AdenaResponse>;
  DoContract(params: { messages: TxMessage[]; gasFee: number; gasWanted: number; memo?: string }): Promise<AdenaResponse<TxResult>>;
  On(event: "changedAccount" | "changedNetwork", callback: (value: string) => void): void;
};

declare global {
  interface Window {
    adena?: AdenaWallet;
  }
}

export type Account = { address: string; chainId: string };

export type TxSuccess = {
  hash: string;
  height: number;
  /** Valeur renvoyée par la fonction du contrat, ex. `("roll=4;won=false;payout=0" string)`. */
  returned: string;
};

export class WalletError extends Error {
  readonly code: "NO_EXTENSION" | "REJECTED" | "LOCKED" | "FAILED";
  constructor(code: WalletError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export const ADENA_DOWNLOAD_URL = "https://adena.app";

// --- Détection de l'extension ---

/** Attend que l'extension Adena soit disponible (elle se charge après la page). */
export async function getAdena(timeoutMs = 1500): Promise<AdenaWallet | null> {
  if (typeof window === "undefined") return null;
  const start = Date.now();
  while (!window.adena && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return window.adena ?? null;
}

async function requireAdena(): Promise<AdenaWallet> {
  const adena = await getAdena();
  if (!adena) {
    throw new WalletError("NO_EXTENSION", "L'extension Adena n'est pas installée dans ce navigateur.");
  }
  return adena;
}

// --- Connexion et compte ---

/** Demande à Adena d'autoriser le site, puis renvoie le compte actif. */
export async function connectWallet(): Promise<Account> {
  const adena = await requireAdena();
  const res = await adena.AddEstablish(SITE_NAME);
  if (res.status !== "success" && res.type !== "ALREADY_CONNECTED") {
    if (res.type === "CONNECTION_REJECTED") throw new WalletError("REJECTED", "Connexion refusée dans Adena.");
    throw new WalletError("FAILED", res.message || "Connexion à Adena impossible.");
  }
  return getAccount();
}

/** Renvoie le compte actif d'Adena (le site doit déjà être autorisé). */
export async function getAccount(): Promise<Account> {
  const adena = await requireAdena();
  const res = await adena.GetAccount();
  if (res.status !== "success" || !res.data?.address) {
    if (res.type === "WALLET_LOCKED") throw new WalletError("LOCKED", "Adena est verrouillé : ouvre l'extension et saisis ton mot de passe.");
    throw new WalletError("FAILED", res.message || "Impossible de lire le compte Adena.");
  }
  return { address: res.data.address, chainId: res.data.chainId };
}

/** Bascule Adena sur le réseau du site (et l'ajoute s'il est inconnu d'Adena). */
export async function switchToSiteNetwork(): Promise<void> {
  const adena = await requireAdena();
  let res = await adena.SwitchNetwork(config.chainId);
  if (res.type === "UNADDED_NETWORK") {
    const added = await adena.AddNetwork({
      chainId: config.chainId,
      chainName: config.chainName,
      rpcUrl: config.rpcUrl,
    });
    if (added.status !== "success") {
      throw new WalletError(added.type === "ADD_NETWORK_REJECTED" ? "REJECTED" : "FAILED", added.message || "Ajout du réseau refusé.");
    }
    res = await adena.SwitchNetwork(config.chainId);
  }
  if (res.status !== "success" && res.type !== "REDUNDANT_CHANGE_REQUEST") {
    throw new WalletError(res.type === "SWITCH_NETWORK_REJECTED" ? "REJECTED" : "FAILED", res.message || "Changement de réseau refusé.");
  }
}

// --- Événements (changement de compte ou de réseau dans Adena) ---

type Listener = () => void;
const listeners = new Set<Listener>();
let subscribed = false;

/** Appelle `listener` quand l'utilisateur change de compte ou de réseau dans Adena. */
export function onWalletChange(listener: Listener): () => void {
  listeners.add(listener);
  if (!subscribed && typeof window !== "undefined" && window.adena) {
    // Adena ne permet pas de se désabonner : on s'abonne une seule fois.
    subscribed = true;
    window.adena.On("changedAccount", () => listeners.forEach((l) => l()));
    window.adena.On("changedNetwork", () => listeners.forEach((l) => l()));
  }
  return () => {
    listeners.delete(listener);
  };
}

// --- Transactions ---

/**
 * Demande à Adena de signer et d'envoyer une transaction.
 * Renvoie le résultat si elle a réussi, sinon lève une WalletError avec un
 * message compréhensible.
 */
export async function sendTransaction(messages: TxMessage[], gasWanted: number, gasFee: number): Promise<TxSuccess> {
  const adena = await requireAdena();
  let res: AdenaResponse<TxResult>;
  try {
    res = await adena.DoContract({ messages, gasFee, gasWanted, memo: "" });
  } catch (e) {
    throw new WalletError("FAILED", friendlyError(String(e)));
  }

  if (res.status !== "success") {
    if (res.type === "TRANSACTION_REJECTED" || res.type === "SIGN_REJECTED") {
      throw new WalletError("REJECTED", "Transaction annulée dans Adena.");
    }
    if (res.type === "WALLET_LOCKED") {
      throw new WalletError("LOCKED", "Adena est verrouillé : ouvre l'extension et saisis ton mot de passe.");
    }
    throw new WalletError("FAILED", friendlyError(JSON.stringify(res)));
  }

  const data = res.data ?? {};
  const failed = data.check_tx?.ResponseBase?.Error || data.deliver_tx?.ResponseBase?.Error;
  if (failed) {
    throw new WalletError("FAILED", friendlyError(JSON.stringify(data)));
  }

  return {
    hash: data.hash ?? "",
    height: Number(data.height ?? 0),
    returned: decodeReturned(data.deliver_tx?.ResponseBase?.Data),
  };
}

function decodeReturned(data: string | null | undefined): string {
  if (!data) return "";
  try {
    return fromBase64(data);
  } catch {
    return data;
  }
}

/** Transforme un message d'erreur technique en phrase compréhensible. */
export function friendlyError(raw: string): string {
  // Les erreurs de notre contrat commencent toutes par "gnodice: ".
  const own = /gnodice: ([^"\\\n]+)/.exec(raw);
  if (own) {
    const text = own[1].trim();
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  }
  const lower = raw.toLowerCase();
  if (lower.includes("insufficient") || lower.includes("insufficient funds")) {
    return "Solde insuffisant pour la mise et les frais. Recharge ton wallet (faucet sur le testnet).";
  }
  if (lower.includes("out of gas")) return "La transaction a manqué de gas. Réessaie.";
  if (lower.includes("has not signed the required cla")) {
    return "Tu dois d'abord signer le CLA de gno.land (gno.land/r/sys/cla) pour déployer.";
  }
  if (lower.includes("not authorized to deploy")) {
    return "Tu n'as pas le droit de déployer à ce chemin : utilise ton adresse comme espace de noms.";
  }
  if (lower.includes("package already exists") || lower.includes("already exists")) {
    return "Un contrat existe déjà à ce chemin.";
  }
  if (lower.includes("unknown address") || lower.includes("account not found") || lower.includes("no account")) {
    return "Ce compte n'existe pas encore sur le réseau : envoie-lui d'abord des GNOT (faucet).";
  }
  return "La transaction a échoué. Réessaie dans un instant.";
}
