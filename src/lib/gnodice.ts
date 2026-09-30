// Construction des transactions du jeu GNO-DICE.
// Chaque fonction prépare un « message » que Adena fera signer.

import type { TxMessage } from "./adena";
import { config } from "./config";

/** Lancer le dé : `guess` de 1 à 6, `betUgnot` = mise envoyée avec la transaction. */
export function playMessage(caller: string, guess: number, betUgnot: number, realmPath = config.realmPath): TxMessage {
  return callMessage(caller, realmPath, "Play", [String(guess)], `${betUgnot}ugnot`);
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

// --- Lecture du résultat renvoyé par Play ---

export type PlayResult = { roll: number; won: boolean; payout: number };

/** Lit la réponse de Play, ex. `("roll=4;won=false;payout=0" string)`. */
export function parsePlayResult(returned: string): PlayResult | null {
  const m = /roll=(\d);won=(true|false);payout=(\d+)/.exec(returned);
  if (!m) return null;
  return { roll: Number(m[1]), won: m[2] === "true", payout: Number(m[3]) };
}
