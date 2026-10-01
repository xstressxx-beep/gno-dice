# GNO-DICE — CLAUDE.md

## 🎯 Description du projet
Jeu de dés décentralisé sur Gno.land. 
Site : nouveau projet Vercel dédié (ex. https://gnodice.vercel.app/, à créer)
Dépôt GitHub : https://github.com/xstressxx-beep/gno-dice
Contrat : gno.land/r/<adresse-owner>/gnodice

## 🚧 Projet distinct de Gnosino
- Gnosino (la roulette, https://gnosino.vercel.app/, contrat roulette_v6) est un AUTRE projet.
- Ne jamais déployer, modifier ni supprimer quoi que ce soit lié à Gnosino depuis ce dépôt.
- Seul point commun : le même wallet Adena propriétaire (aucun conflit, chemins de contrat différents).

## 🏗️ Stack technique
- Frontend : Next.js / React (déployé sur Vercel)
- Smart Contract : Gno (langage Go déterministe)
- Wallet : Adena
- Token : GNOT

## 📏 Règles du jeu
- Mise entre 1 et 10 GNOT
- 1 essai toutes les 10 minutes
- Gain = 5x la mise si le bon chiffre est deviné (1 à 6)

## ✅ Ce que tu peux faire seul
- Modifier les fichiers frontend (composants, styles)
- Écrire et optimiser les smart contracts Gno
- Créer les tests
- Faire les commits Git
- Tout ce que tu peux faire seul tu le fais mais tu dois m'expliquer ce que ta fais simplement je suis un debutant

## ❌ Ce que tu ne peux PAS faire (tu dois me demander)
- Déployer sur Vercel (je le fais)
- Signer les transactions blockchain (je le fais avec Adena)
- Déployer le smart contract on-chain

## 🎨 Style & conventions
- Commentaires en français
- Composants React en TypeScript
- Ne jamais casser le design existant sans validation