"use client";

import { useTranslations } from "next-intl";

// Les messages d'erreur de src/lib (Adena, réseau Gno) sont écrits en français.
// On les traduit ici à l'affichage, sans toucher à src/lib. Un message inconnu
// (par exemple une erreur du contrat) s'affiche tel quel.
const KNOWN: Record<string, string> = {
  "L'extension Adena n'est pas installée dans ce navigateur.": "noExtension",
  "Connexion refusée dans Adena.": "rejected",
  "Connexion à Adena impossible.": "connectFailed",
  "Adena est verrouillé : ouvre l'extension et saisis ton mot de passe.": "locked",
  "Impossible de lire le compte Adena.": "accountFailed",
  "Ajout du réseau refusé.": "addNetwork",
  "Changement de réseau refusé.": "switchNetwork",
  "Transaction annulée dans Adena.": "txCancelled",
  "Solde insuffisant pour la mise et les frais. Recharge ton wallet (faucet sur le testnet).": "insufficient",
  "La transaction a manqué de gas. Réessaie.": "outOfGas",
  "Ce compte n'existe pas encore sur le réseau : envoie-lui d'abord des GNOT (faucet).": "noAccount",
  "La transaction a échoué. Réessaie dans un instant.": "txFailed",
  "Impossible de joindre le réseau Gno. Vérifie ta connexion.": "unreachable",
  "Réponse inattendue du nœud Gno.": "rpc",
  "Le contrat a renvoyé une valeur inattendue.": "badValue",
};

/** Renvoie une fonction qui traduit un message d'erreur venant de src/lib. */
export function useErrorText() {
  const t = useTranslations("errors");
  return (message: string) => (KNOWN[message] ? t(KNOWN[message]) : message);
}
