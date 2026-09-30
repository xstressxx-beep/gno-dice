# 🎲 GNO-DICE

Jeu de dés décentralisé sur [Gno.land](https://gno.land).

- Choisis un chiffre de **1 à 6**, mise entre **1 et 10 GNOT**.
- Si le dé tombe sur ton chiffre, tu gagnes **5 fois ta mise**.
- **Un lancer toutes les 10 minutes** par joueur.
- Tout se passe dans un **smart contract Gno** : il reçoit la mise, lance le dé, paie le gagnant et garde l’historique.

Le site (Next.js) sert d’interface : il lit le contrat gratuitement et demande à ton wallet **Adena** de signer les transactions.

---

## Sommaire

1. [Ce qu’il y a dans le projet](#1-ce-quil-y-a-dans-le-projet)
2. [Lancer le site sur ton ordinateur](#2-lancer-le-site-sur-ton-ordinateur)
3. [Mettre le site en ligne (GitHub + Vercel)](#3-mettre-le-site-en-ligne-github--vercel)
4. [Déployer le contrat depuis le site (avec Adena)](#4-déployer-le-contrat-depuis-le-site-avec-adena)
5. [Les tests](#5-les-tests)
6. [Sécurité et limites (à lire !)](#6-sécurité-et-limites-à-lire-)
7. [Passer au mainnet plus tard](#7-passer-au-mainnet-plus-tard)
8. [Dépannage](#8-dépannage)

---

## 1. Ce qu’il y a dans le projet

```
Gnodice/
├── contract/gnodice/        ← le smart contract Gno
│   ├── gnodice.gno          ← règles du jeu : Play, Fund, Withdraw, SetPaused…
│   ├── api.gno              ← lectures pour le site (GetInfoJSON, GetPlayerJSON)
│   ├── render.gno           ← page lisible sur gnoweb
│   ├── gnodice_test.gno     ← 14 tests du contrat
│   └── gnomod.toml
├── src/
│   ├── app/                 ← pages du site : / (jeu) et /admin
│   ├── components/          ← morceaux d’interface (table de jeu, historique…)
│   ├── hooks/               ← lecture régulière des données du contrat
│   └── lib/                 ← communication avec la blockchain et Adena (+ tests)
├── .env.example             ← modèle des réglages (réseau, adresse du contrat)
└── package.json
```

**Réseau par défaut : Onyx (`onyx-1`)**, le testnet officiel de Gno.land. Il fait tourner exactement le même code que le
mainnet, et ses GNOT sont **gratuits** (faucet). Tu peux tester sans risquer de vrai argent.

---

## 2. Lancer le site sur ton ordinateur

Il faut [Node.js](https://nodejs.org) (déjà installé chez toi : v24).

```bash
npm install        # installe les dépendances (une seule fois)
npm run dev        # lance le site sur http://localhost:3000
```

Tant que le contrat n’est pas déployé, le site affiche « Le contrat GNO-DICE n’est pas encore déployé » : c’est normal.

---

## 3. Mettre le site en ligne (GitHub + Vercel)

Le code est déjà enregistré dans Git (commit fait). Il reste à l’envoyer sur GitHub puis à le brancher sur Vercel.

> ⚠️ **Attention : `gnosino.vercel.app` héberge actuellement ta roulette « Gnosino ».**
> Si tu déploies GNO-DICE dans **ce même projet Vercel**, la roulette sera **remplacée**.
> Crée un **nouveau projet Vercel** (par ex. `gnodice.vercel.app`), sauf si tu veux vraiment remplacer la roulette.

1. Sur <https://github.com/new>, crée un dépôt **vide** nommé `gnodice` (ne coche ni README, ni .gitignore, ni licence).
2. Dans un terminal ouvert dans ce dossier (`Documents\Gnodice`) :
   ```bash
   git remote add origin https://github.com/<ton-compte-github>/gnodice.git
   git push -u origin main
   ```
   Une fenêtre GitHub s’ouvre la première fois pour te connecter : c’est normal.
3. Sur <https://vercel.com/new>, clique **Import** à côté du dépôt `gnodice`.
   Vercel détecte Next.js tout seul : **ne change aucun réglage**, aucune variable n’est nécessaire. Clique **Deploy**. ✅

Ensuite, à chaque `git push`, Vercel remet le site à jour automatiquement.

---

## 4. Déployer le contrat depuis le site (avec Adena)

Pas besoin d’installer d’outil Gno : le site envoie le contrat, c’est toi qui signes dans Adena.

1. Dans **Adena**, utilise ton compte habituel **`g1u97n45s4s6q7vn5clr8339pv4up455hnqn4aff`** (celui de la roulette) et choisis
   le réseau **Onyx** (le site te le propose automatiquement sinon).
2. **Récupère des GNOT gratuits** sur <https://faucet.gno.land> (réseau Onyx). Prévois ~60 GNOT : 4 pour le déploiement,
   50 pour la banque du jeu, le reste pour jouer.
3. Ouvre **`https://<ton-site>.vercel.app/admin`**, clique **« Connecter Adena »** puis **« Déployer le contrat »**, et accepte dans Adena.
   - Le contrat est publié à `gno.land/r/g1u97n45s4s6q7vn5clr8339pv4up455hnqn4aff/gnodice` et **tu en deviens le propriétaire**.
   - Coût : environ **3,5 GNOT bloqués** (dépôt de stockage : le code prend de la place sur la blockchain) + ~0,1 GNOT de frais.
   - Sur Onyx, un « oracle » officiel vérifie le code avant de l’activer : l’état passe de *en attente* à *✔ actif*,
     en général en quelques minutes. La page se met à jour toute seule.
4. Quand la page affiche **« ✔ C’est le contrat utilisé par le site : rien à configurer »**, **alimente la banque**
   (section « Gérer la banque ») : c’est elle qui paie les gains. Pour accepter la mise maximale de 10 GNOT, elle doit
   contenir **au moins 40 GNOT** ; 50 à 100 GNOT est un bon début.
5. Retourne sur la page d’accueil : **tu peux jouer** 🎲

Le contrat est aussi visible sur gnoweb :
<https://onyx.testnets.gno.land/r/g1u97n45s4s6q7vn5clr8339pv4up455hnqn4aff/gnodice>

**Tu déploies avec un autre wallet ?** La page `/admin` te l’indique et affiche le chemin exact. Ajoute-le alors sur Vercel
(Settings → Environment Variables → `NEXT_PUBLIC_GNODICE_REALM`), puis **redéploie** (Deployments → ⋯ → Redeploy) :
les variables sont intégrées au site au moment du build.

---

## 5. Les tests

**Tests du site** (31 vérifications : lecture des réponses de la blockchain, construction des transactions, messages
d’erreur…) :

```bash
npm test
```

**Tests du contrat** (14 tests : règles du jeu, sécurité, cooldown, paiements, historique). Il faut l’outil `gno`
([installation](https://docs.gno.land/builders/install)), puis depuis `contract/gnodice` :

```bash
gno test -v .
```

Autres vérifications : `npm run lint` (qualité du code) et `npm run build` (le même build que Vercel).

---

## 6. Sécurité et limites (à lire !)

- **Le hasard n’est pas parfait.** Une blockchain est déterministe : il n’existe pas de vrai hasard. Le contrat mélange
  (SHA-256) l’heure exacte du bloc, sa hauteur, le numéro de partie, l’adresse du joueur et l’historique des parties.
  Un joueur ne peut pas prévoir le résultat quand il signe, mais **un validateur malveillant pourrait l’influencer**.
  C’est très bien pour un testnet ; **pour de vrais montants sur le mainnet, il faudrait une meilleure source de hasard**
  (par ex. un système « commit-reveal » ou un oracle).
- **Protections en place :**
  - seuls les appels directs depuis un wallet sont acceptés (un autre contrat ou un script ne peut pas tricher en
    annulant ses parties perdues) ;
  - la banque doit pouvoir payer 5× la mise, sinon la partie est refusée et la mise rendue ;
  - perdre coûte toujours moins de gas que gagner (impossible d’annuler seulement ses défaites) ;
  - seules les actions « Retirer », « Pause » et « Transfert de propriété » sont réservées au propriétaire.
- **Avantage de la maison** : 1 chance sur 6 de gagner 5× → le joueur récupère en moyenne 83 % de ses mises.
- **Frais pour le joueur** : ~0,02 GNOT de frais réseau par lancer, et environ 0,44 GNOT de dépôt de stockage lors de la
  toute première partie d’un joueur (la place de son historique sur la blockchain).
- Le site ne voit **jamais** ta clé privée : Adena signe, toi tu acceptes ou refuses.

---

## 7. Passer au mainnet plus tard

Le mainnet Gno.land (`gnoland-1`) est lancé depuis le 12/09/2026. Les GNOT y ont une vraie valeur et il n’y a pas de
faucet. **Ne le fais qu’après avoir amélioré la source de hasard (voir section 6)** et fait relire le contrat.
Il suffira alors de redéployer le contrat sur le mainnet et de changer les variables (valeurs dans `.env.example`).

---

## 8. Dépannage

| Problème | Solution |
|---|---|
| « Installer Adena » alors qu’Adena est installé | Recharge la page ; vérifie qu’Adena est déverrouillé. |
| « Changer de réseau » | Clique dessus et accepte dans Adena (Onyx sera ajouté s’il manque). |
| « Solde insuffisant » | Recharge ton wallet sur <https://faucet.gno.land>. |
| « Mise max possible : X GNOT » / « La banque est vide » | Alimente la banque depuis `/admin`. |
| « Prochain lancer dans mm:ss » | C’est la règle des 10 minutes, patience 🙂 |
| Le contrat reste « en attente d’activation » | L’oracle d’Onyx vérifie le code ; attends quelques minutes et recharge `/admin`. |
| « Le contrat GNO-DICE n’est pas encore déployé » | Déploie-le depuis `/admin` (section 4). Si tu l’as déployé avec un autre wallet que `g1u97n…4aff`, ajoute `NEXT_PUBLIC_GNODICE_REALM` sur Vercel puis **redéploie**. |
| « Activation du contrat en cours… » | L’oracle d’Onyx vérifie le code : patiente quelques minutes, la page se met à jour seule. |
| `git push` refusé | Vérifie que le dépôt GitHub existe, qu’il est vide, et que l’adresse après `git remote add origin` est la bonne. |
