// Construction des transactions du jeu GNO-DICE.
// Chaque fonction prépare un « message » que Adena fera signer.

import type { TxMessage } from "./adena";
import { config } from "./config";

/**
 * Miser sur un chiffre caché : `commitment` = empreinte du chiffre (voir
 * lib/fairness.ts), `betUgnot` = mise envoyée avec la transaction.
 */
export function playMessage(caller: string, commitment: string, betUgnot: number, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "Play", [commitment], `${betUgnot}ugnot`);
}

/** Dévoiler son chiffre et son secret pour terminer une partie (et encaisser si gagné). */
export function revealMessage(caller: string, id: number, guess: number, salt: string, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "Reveal", [String(id), String(guess), salt]);
}

/** Récupérer sa mise si le croupier n'a pas tiré le dé à temps. */
export function refundMessage(caller: string, id: number, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "Refund", [String(id)]);
}

/** Désigner l'adresse du croupier (propriétaire uniquement). */
export function setCroupierMessage(caller: string, croupier: string, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "SetCroupier", [croupier]);
}

/** Régler le coupe-circuit et le seuil d'alerte, en ugnot (propriétaire uniquement). */
export function setLimitsMessage(caller: string, dailyLimit: number, lowBankroll: number, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "SetLimits", [String(dailyLimit), String(lowBankroll)]);
}

/** Interdire ou autoriser une adresse (propriétaire uniquement). */
export function setBlockedMessage(caller: string, player: string, blocked: boolean, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "SetBlocked", [player, String(blocked)]);
}

/** Alimenter la banque du jeu (tout le monde peut le faire). */
export function fundMessage(caller: string, amountUgnot: number, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "Fund", [], `${amountUgnot}ugnot`);
}

/** Retirer des GNOT de la banque (propriétaire uniquement). */
export function withdrawMessage(caller: string, amountUgnot: number, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "Withdraw", [String(amountUgnot)]);
}

/** Mettre le jeu en pause ou le relancer (propriétaire uniquement). */
export function setPausedMessage(caller: string, paused: boolean, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "SetPaused", [String(paused)]);
}

function callMessage(caller: string, pkgPath: string, func: string, args: string[], send = ""): TxMessage {
  return {
    type: "/vm.m_call",
    value: { caller, send, max_deposit: "", pkg_path: pkgPath, func, args },
  };
}

// --- Déploiement du contrat ---

export type ContractFile = { name: string; body: string };

/** Chemin où une adresse peut déployer le contrat : gno.land/r/<adresse>/gnodice */
export function realmPathFor(address: string): string {
  return `gno.land/r/${address}/gnodice`;
}

/**
 * Prépare le déploiement du contrat sous le nom de `creator`.
 * On ajoute un gnomod.toml avec le bon chemin ; les fichiers doivent être
 * triés par nom (règle de la blockchain).
 */
export function deployMessage(creator: string, files: ContractFile[]): TxMessage {
  const path = realmPathFor(creator);
  const gnomod: ContractFile = { name: "gnomod.toml", body: `module = "${path}"\ngno = "0.9"\n` };
  const all = [...files.filter((f) => f.name !== "gnomod.toml"), gnomod].sort((a, b) => (a.name < b.name ? -1 : 1));
  return {
    type: "/vm.m_addpkg",
    value: {
      creator,
      send: "",
      max_deposit: "",
      package: { name: "gnodice", path, files: all },
    },
  };
}

// --- Lecture des réponses du contrat ---

/** Lit le numéro de partie renvoyé par Play, ex. `("id=42" string)`. */
export function parsePlayId(returned: string): number | null {
  const m = /id=(\d+)/.exec(returned);
  return m ? Number(m[1]) : null;
}

export type PlayResult = { roll: number; won: boolean; payout: number };

/** Lit la réponse de Reveal, ex. `("roll=4;won=false;payout=0" string)`. */
export function parsePlayResult(returned: string): PlayResult | null {
  const m = /roll=(\d);won=(true|false);payout=(\d+)/.exec(returned);
  if (!m) return null;
  return { roll: Number(m[1]), won: m[2] === "true", payout: Number(m[3]) };
}
