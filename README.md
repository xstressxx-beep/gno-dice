# 🎲 GNO-DICE

Jeu de dés décentralisé sur [Gno.land](https://gno.land).

- Choisis un chiffre de **1 à 6**, mise entre **1 et 10 GNOT**.
- Si le dé tombe sur ton chiffre, tu gagnes **5 fois ta mise**.
- **Un lancer toutes les 10 minutes** par joueur.
- Tout se passe dans un **smart contract Gno** : il reçoit la mise, vérifie le tirage, paie le gagnant et garde l’historique.
- Le jeu est **prouvablement équitable** : ton chiffre reste caché pendant que le **croupier** (un service du site) tire le
  dé, puis il est dévoilé et vérifié par le contrat. Personne, ni toi ni la maison, ne peut choisir le résultat.

Le site (Next.js) sert d’interface : il lit le contrat gratuitement et demande à ton wallet **Adena** de signer les transactions.
Le rapport d’audit de sécurité complet est dans [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

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
│   ├── gnodice.gno          ← règles, données, explication du jeu en 3 étapes
│   ├── game.gno             ← Play, Resolve, Reveal, Refund, Expire
│   ├── fairness.gno         ← empreinte du chiffre caché et calcul du dé (SHA-256)
│   ├── bank.gno             ← banque, réserve, coupe-circuit, alertes
│   ├── admin.gno            ← pause, croupier, limites, liste noire, propriété
│   ├── api.gno              ← lectures pour le site (JSON)
│   ├── render.gno           ← page lisible sur gnoweb (avec vérification des tirages)
│   ├── gnodice_test.gno     ← 26 tests du contrat (dont attaques et 1 000 parties)
│   └── gnomod.toml
├── contract/audit/          ← preuve de la faille de l’ancienne version (lecture seule)
├── e2e/                     ← tests de bout en bout sur une vraie chaîne locale
├── scripts/                 ← lancement des tests du contrat
├── src/
│   ├── app/                 ← pages du site : / (jeu), /admin, et /api/croupier (serveur)
│   ├── components/          ← morceaux d’interface (dé 3D, table de jeu, historique…)
│   │   └── ui/              ← composants de base shadcn/ui (boutons, onglets, curseur…)
│   ├── hooks/               ← lecture régulière des données du contrat
│   └── lib/                 ← blockchain, Adena, équité, croupier (lib/server) + tests
├── .env.example             ← modèle des réglages (réseau, contrat, croupier)
├── vercel.json              ← tâche planifiée du croupier
├── tailwind.config.ts       ← couleurs et animations du thème (Tailwind CSS v3)
├── components.json          ← réglages shadcn/ui
└── package.json
```

**Design « casino de luxe »** : Tailwind CSS v3 (styles), shadcn/ui + Radix UI (composants accessibles au clavier),
Framer Motion (dé 3D qui roule, bouton JOUER qui pulse, connexion Adena), React Spring (chiffres qui défilent, gains qui
montent) et GSAP (explosion de particules dorées, poussière d’or en fond). Les couleurs sont définies une seule fois dans
`src/app/globals.css`.

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

> ⚠️ **GNO-DICE et la roulette « Gnosino » sont deux projets distincts.**
> `gnosino.vercel.app` reste réservé à la roulette : ne branche **pas** ce dépôt sur ce projet Vercel.
> Crée un **nouveau projet Vercel** dédié (par ex. `gnodice.vercel.app`).

1. Le dépôt GitHub existe déjà : <https://github.com/xstressxx-beep/gno-dice>.
2. Dans un terminal ouvert dans ce dossier (`Documents\Gnodice`), envoie le code :
   ```bash
   git push -u origin main
   ```
   Une fenêtre GitHub s’ouvre la première fois pour te connecter : c’est normal.
3. Sur <https://vercel.com/new>, clique **Import** à côté du dépôt `gno-dice` (un **nouveau** projet, pas celui de Gnosino).
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
   - Coût : quelques GNOT **bloqués** (dépôt de stockage : le code prend de la place sur la blockchain) + ~0,1 GNOT de frais
     (gas mesuré : ~59 millions).
   - Sur Onyx, un « oracle » officiel vérifie le code avant de l’activer : l’état passe de *en attente* à *✔ actif*,
     en général en quelques minutes. La page se met à jour toute seule.
4. **Configure le croupier** (obligatoire : sans lui, aucun dé n’est tiré) :
   - crée dans Adena un **nouveau compte dédié** au croupier, envoie-lui **5 GNOT** (pour payer le gas de ses tirages) et
     note sa phrase secrète ;
   - sur Vercel (Settings → Environment Variables), ajoute **`CROUPIER_MNEMONIC`** = cette phrase secrète et
     **`CRON_SECRET`** = une longue suite aléatoire, puis **redéploie** ;
   - sur `/admin`, section « Surveillance et sécurité », clique **« Utiliser ce croupier »** et accepte dans Adena ;
   - ⚠️ ne mets jamais cette phrase dans une variable `NEXT_PUBLIC_…` ni dans Git : elle deviendrait publique.
5. Quand la page affiche **« ✔ C’est le contrat utilisé par le site : rien à configurer »**, **alimente la banque**
   (section « Gérer la banque ») : c’est elle qui paie les gains. Pour accepter la mise maximale de 10 GNOT, elle doit
   avoir **au moins 40 GNOT disponibles** ; 50 à 100 GNOT est un bon début.
6. Retourne sur la page d’accueil : **tu peux jouer** 🎲

Le contrat est aussi visible sur gnoweb :
<https://onyx.testnets.gno.land/r/g1u97n45s4s6q7vn5clr8339pv4up455hnqn4aff/gnodice>

**Tu déploies avec un autre wallet ?** La page `/admin` te l’indique et affiche le chemin exact. Ajoute-le alors sur Vercel
(Settings → Environment Variables → `NEXT_PUBLIC_GNODICE_REALM`), puis **redéploie** (Deployments → ⋯ → Redeploy) :
les variables sont intégrées au site au moment du build.

---

## 5. Les tests

**Tests du site** (67 vérifications : équité identique au contrat, croupier avec fausse blockchain, surveillance,
transactions, messages d’erreur…) :

```bash
npm test
```

**Tests du contrat** (26 tests : règles du jeu, une attaque par test, coupe-circuit, 1 000 parties). Il faut Go et le
dépôt Gno cloné ([installation](https://docs.gno.land/builders/install)) :

```bash
git clone https://github.com/gnolang/gno.git ~/tools/gno-src
cd ~/tools/gno-src && go install ./gnovm/cmd/gno ./contribs/gnodev
cd <dossier Gnodice> && npm run test:contract     # GNO_ROOT / GNO_BIN si installés ailleurs
```

**Tests de bout en bout** (vraies transactions sur une chaîne locale : partie complète, triches refusées, 8 joueurs en
parallèle). Après `npm run test:contract` (qui copie le contrat dans `~/tools/gno-src/examples`), dans un premier
terminal ouvert dans `~/tools/gno-src/examples` :

```bash
gnodev local -paths gno.land/r/example/gnodice -no-web -empty-blocks
```

puis dans un second terminal : `npm run test:e2e`.

Autres vérifications : `npm run lint` (qualité du code) et `npm run build` (le même build que Vercel).

---

## 6. Sécurité et limites (à lire !)

Le détail (failles trouvées, corrections, tests) est dans [SECURITY_AUDIT.md](SECURITY_AUDIT.md). L’essentiel :

- **Le jeu en 3 étapes** : tu mises sur un chiffre **caché** (son empreinte SHA-256 avec un secret aléatoire gardé dans ton
  navigateur) → le croupier tire le dé **sans connaître ton chiffre** et publie sa graine → ton chiffre est dévoilé, le
  contrat vérifie et paie. Le site recalcule chaque tirage pour le vérifier.
- **Ne change pas de navigateur entre la mise et la fin de la partie** : le secret est gardé dans celui-ci. Le site
  termine la partie tout seul, en général en quelques secondes.
- **Filets de sécurité** : si le croupier ne répond pas en 30 minutes, tu récupères ta mise (bouton « Récupérer ma
  mise ») ; une partie jamais dévoilée expire après 7 jours et compte perdue.
- **La banque réserve 5× chaque mise** : elle ne peut jamais promettre plus que ce qu’elle possède, et le propriétaire
  ne peut retirer que la part non réservée.
- **Coupe-circuit** : au-delà de 500 GNOT de gains dans la journée (réglable), le jeu se met en pause tout seul.
- **Confiance dans le croupier** : il ne peut pas tricher contre un joueur (il ne connaît pas son chiffre). Si sa clé
  était volée, le coupe-circuit limite les pertes ; change alors de croupier dans `/admin`.
- **Avantage de la maison** : 1 chance sur 6 de gagner 5× → le joueur récupère en moyenne 83 % de ses mises.
- **Frais pour le joueur** : ~0,02 GNOT de frais réseau par lancer, et environ 0,85 GNOT de dépôt de stockage lors de la
  toute première partie d’un joueur (mesuré sur une chaîne locale ; la place de sa fiche sur la blockchain).
- Le site ne voit **jamais** ta clé privée : Adena signe, toi tu acceptes ou refuses.

---

## 7. Passer au mainnet plus tard

Le mainnet Gno.land (`gnoland-1`) est lancé depuis le 12/09/2026. Les GNOT y ont une vraie valeur et il n’y a pas de
faucet. Suis d’abord la **checklist de mise en production** de [SECURITY_AUDIT.md](SECURITY_AUDIT.md) et fais relire le contrat par
un auditeur indépendant.
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
| Le dé ne roule pas, aucune animation | Ton ordinateur demande de « réduire les animations » : le site respecte ce choix (accessibilité). Sur Windows : Paramètres → Accessibilité → Effets visuels → active **Effets d’animation**, puis recharge la page. |
| `git push` refusé | Vérifie que le dépôt GitHub existe, qu’il est vide, et que l’adresse après `git remote add origin` est la bonne. |
