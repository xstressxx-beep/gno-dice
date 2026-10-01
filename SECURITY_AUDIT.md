# Rapport d'audit de sécurité et d'architecture : GNO-DICE

*Date : 1er octobre 2026. Branche : `security-audit`. Périmètre : le contrat `contract/gnodice`, le site Next.js
(`src/`), le nouveau service croupier (`src/lib/server`, `src/app/api/croupier`).*

## En bref

L'ancienne version du contrat avait **une faille critique** : un joueur pouvait **vider la banque sans jamais perdre**.
Elle est prouvée par un test (25 victoires, 0 défaite, banque de 1 000 GNOT vidée), puis corrigée par une refonte
« prouvablement équitable » en 3 étapes. Ce refonte a été vérifiée par :

- **26 tests du contrat**, dont un par attaque et un test de charge de 1 000 parties ;
- **67 tests du site et du croupier** ;
- **3 tests de bout en bout** sur une vraie blockchain Gno locale (transactions signées, 8 joueurs en parallèle).

Ces tests réels ont trouvé **un second défaut bloquant** que les tests unitaires ne pouvaient pas voir : les limites de gas
du site étaient trop basses, **toutes les mises auraient échoué** sur une vraie chaîne.

| Score | Avant | Après |
|---|---|---|
| Sécurité | 35 / 100 | **92 / 100** |
| Architecture | 60 / 100 | **93 / 100** |

Les deux scores restent **sous 95** pour des raisons que je ne peux pas régler seul ; elles sont détaillées à la fin
(« Pour dépasser 95 ») : un essai réel sur le testnet Onyx avec Adena, et une relecture par un auditeur indépendant.

---

## 1. Failles trouvées et corrigées

Gravité : **C** critique · **H** haute · **M** moyenne · **L** faible.

### C-1 : Vidage de la banque en annulant ses défaites (ancienne version)

- **Exploit.** Le dé était tiré pendant `Play` à partir de données publiques : l'état du contrat, lisible par n'importe
  quel nœud, plus l'heure et la hauteur du bloc. Or une transaction Gno peut contenir **plusieurs messages exécutés
  « tout ou rien »**. Un attaquant envoie :
  1. un petit script (`MsgRun`) qui recalcule le dé dans le même bloc et s'arrête en erreur si le résultat ne lui
     convient pas ;
  2. un `MsgCall` vers `Play` avec le chiffre gagnant.

  Si le dé ne convient pas, toute la transaction est annulée et rien n'est misé. Variante : un message *après* `Play`
  qui lit le résultat et annule tout en cas de perte. La protection `IsUserCall()` ne suffisait pas, car `Play` restait
  un appel direct.
- **Preuve.** `contract/audit/exploit_poc_v1.gno.txt` : **25 victoires, 0 défaite, banque 1 000 → 0 GNOT**.
- **Correction.** Le jeu passe en 3 étapes (`game.gno`, `fairness.gno`) :
  1. `Play` : le joueur mise sur un chiffre **caché**, c'est-à-dire l'empreinte
     `sha256("gnodice|v1|commit|" + adresse + "|" + chiffre + "|" + secret de 32 octets)`. Aucun dé n'est tiré à ce
     moment-là : il n'y a rien à prédire ni à annuler.
  2. `Resolve` : le **croupier** fournit une graine aléatoire de 32 octets **sans connaître le chiffre**, et le dé est
     calculé à partir de la graine, de l'empreinte et du numéro de partie. La graine est publiée.
  3. `Reveal` : le chiffre et le secret sont dévoilés, le contrat vérifie l'empreinte et paie. Le résultat est déjà
     fixé, donc annuler cette transaction ne sert à rien.
- **Tests.** `TestSecurityNoOutcomeAtPlayTime`, `TestSecurityRevealChecks`, test de bout en bout « partie complète ».

### C-2 : Résultat influençable par un validateur (ancienne version)

- **Exploit.** Le validateur qui produit le bloc en choisit l'heure, à la nanoseconde. Il pouvait essayer plusieurs
  heures et garder celle qui fait gagner son propre pari.
- **Correction.** Corrigé par C-1 : le dé ne dépend plus d'aucune donnée de bloc.

### H-1 : Toutes les mises auraient échoué sur une vraie chaîne (gas)

- **Constat.** Le gas a été mesuré sur une chaîne locale avec de vraies transactions :

  | Opération | Gas mesuré |
  |---|---|
  | `Play` | ~16,5 M |
  | Révélation gagnante | ~14,8 M |
  | Révélation perdante | ~13,6 M |
  | Tirage | ~7,3 M |
  | Déploiement | ~58,7 M |

  Le site demandait 15 M pour une mise et 10 M pour une révélation : les mises et les révélations relayées échouaient
  par manque de gas.
- **Correction.** Limites mesurées +50 % dans `src/lib/config.ts`. Le dépôt de stockage de la 1re partie est ~0,84 GNOT
  (le site prévoyait 0,5).
- **Test.** `e2e/fullgame.e2e.test.ts`.

### H-2 : Un fournisseur de hasard pourrait viser un joueur

- **Exploit.** Si le chiffre était visible, celui qui fournit le hasard (croupier, oracle) pourrait choisir une graine
  qui fait perdre ce joueur.
- **Correction.** Le chiffre reste caché jusqu'au tirage. Le secret doit faire 32 octets : un secret court laisserait
  le croupier retrouver le chiffre en essayant les 6 possibilités. Il est généré par le navigateur avec
  `crypto.getRandomValues`.
- **Test.** `TestSecurityRevealChecks` (refus d'un secret court).

### H-3 : Course entre tirage tardif et remboursement

- **Exploit.** Le croupier est en retard et envoie `Resolve` après les 30 minutes. Le joueur voit la graine passer dans
  la file d'attente publique (mempool), calcule qu'il a perdu, et passe devant avec `Refund` pour récupérer sa mise.
- **Correction.** Les deux fenêtres sont disjointes : `Resolve` n'est possible qu'avant la limite, `Refund` qu'après.
  Le croupier s'arrête aussi 20 s avant la limite.
- **Test.** `TestSecurityResolveRefundWindows`, test croupier « trop proche de la limite ».

### H-4 : Copier l'empreinte d'un autre joueur

- **Exploit.** Bob réutilise l'empreinte visible dans la transaction d'Alice, puis son secret quand elle le dévoile.
- **Correction.** L'empreinte inclut l'adresse du joueur.
- **Test.** `TestSecurityCommitmentBoundToPlayer`.

### H-5 : Banque en sur-engagement, ou retrait de l'argent promis

- **Exploit.** Avec des parties en cours, plusieurs gains ou un retrait du propriétaire pourraient dépasser ce que la
  banque possède.
- **Correction.** Chaque mise **réserve 5× son montant** (`reserved`). Une nouvelle mise n'est acceptée que si le solde
  *disponible* la couvre, et `Withdraw` ne retire que le disponible.
- **Tests.** `TestSecurityBankNeverOvercommits`, `TestSecurityWithdrawRespectsReserve`, `TestStress1000Games`
  (comptabilité exacte à l'ugnot près).

### H-6 : Croupier compromis

- **Risque.** Un voleur de la clé du croupier qui joue en même temps connaît son propre chiffre : il peut se faire
  gagner.
- **Correction.**
  - **Coupe-circuit** : au-delà de 500 GNOT de gains par jour (réglable), pause automatique.
  - **Alerte** « taux de victoire anormal » (test statistique, z > 4).
  - Changement de croupier en un clic.
  - Le croupier n'a **aucun** droit d'administration.
- **Tests.** `TestSecurityCircuitBreaker`, `TestSecurityCroupierRotation`, `TestSecurityAdminOnlyOwner`,
  `monitoring.test.ts`.

### M-1 : Perte de contrôle du contrat par faute de frappe

- **Correction.** Transfert de propriété en 2 temps (`TransferOwnership` puis `AcceptOwnership`).
- **Test.** `TestSecurityTwoStepOwnership`.

### M-2 : Réserve bloquée par des parties jamais dévoilées

- **Correction.** `Expire` après 7 jours : la partie compte comme perdue et la réserve est libérée.
- **Test.** `TestSecurityExpire`.

### M-3 : Double clic sur « Lancer » (front)

- **Exploit.** Une course qui envoie deux mises.
- **Correction.** Verrou `busy` dans `GameTable.tsx`. Côté contrat, le cooldown refuse de toute façon la seconde mise.

### M-4 : Requêtes réseau sans délai maximal

- **Constat.** Une lecture pouvait rester bloquée indéfiniment.
- **Correction.** Délai de 8 s et 2 nouveaux essais, uniquement sur panne réseau ou 5xx (`gno.ts`). Côté croupier :
  file d'attente, nouvel essai seulement sur panne passagère, et **relecture de l'état avant chaque essai**, donc ni
  double tirage ni double paiement.
- **Tests.** `croupier.test.ts` (réponse perdue après succès, erreur contrat sans nouvel essai).

### M-5 : Clickjacking et absence d'en-têtes de sécurité

- **Correction.** CSP (connexions limitées au site et au nœud RPC), `X-Frame-Options: DENY`, `nosniff`, HSTS,
  `Permissions-Policy` (`next.config.ts`).
- **Vérification.** En-têtes vérifiés avec `curl`, aucune violation CSP dans la console.

### M-6 : Croupier gaspillant du gas sur requêtes invalides

- **Correction.** L'API vérifie l'empreinte **avant** d'envoyer une transaction, n'agit que si la partie est au bon
  stade, limite à 30 appels par minute et par IP, et protège la tâche planifiée par jeton (`CRON_SECRET`, comparaison
  à temps constant).
- **Tests.** `croupier.test.ts`, `http.test.ts`.

### L-1 : Erreur de configuration masquée

- **Constat.** Sans phrase secrète, le croupier répondait « transaction échouée ».
- **Correction.** Message clair (HTTP 503).
- **Test.** `croupier.test.ts`.

### L-2 : Pas de liste noire, pas de surveillance

- **Correction.**
  - `SetBlocked` (liste noire).
  - Tableau de bord `/admin` : indicateurs, alertes banque basse, croupier sans gas, parties bloquées, coupe-circuit
    proche, joueur à surveiller.
  - Événements on-chain pour **chaque** action.
  - Journaux JSON structurés côté serveur.

### Points vérifiés sans faille

| Vecteur | Conclusion |
|---|---|
| Réentrance | Impossible : un envoi de GNOT natifs ne rappelle aucun code. L'ordre « contrôles → effets → paiement » est quand même respecté partout. |
| Dépassement d'entier | Montants bornés (10 GNOT × 5 × 10⁶ ugnot ≪ 2⁶³). Compteurs en `int64`. |
| Mise à 0, négative, mauvaise monnaie, plusieurs monnaies | Refusées (`TestSecurityInvalidBets`). |
| Jouer sans les fonds | La chaîne refuse la transaction. Le contrat lit le montant exact envoyé. |
| Appel par un autre contrat ou un script | Refusé par `IsUserCall()` (un script `MsgRun` a `IsUser()` vrai mais `IsUserCall()` faux, vérifié par test). |
| Injection (JSON, Markdown, XSS) | Le JSON n'écrit que des valeurs validées (adresses, hexadécimal, statuts fixes). Les chemins de `Render` sont validés. React échappe tout (`TestSecurityReadsAndRender`). |
| Contourner les 10 minutes | Impossible pour une adresse. Plusieurs adresses (Sybil) restent possibles par nature : ce n'est pas une faille, l'avantage de la maison (83 % de retour) protège la banque. |

---

## 2. Améliorations d'architecture

| Domaine | Ce qui a été fait |
|---|---|
| Contrat modulaire | 7 fichiers à responsabilité unique : règles et données, déroulé d'une partie, équité, banque, administration, lectures, affichage. |
| Erreurs | Chaque refus a un message clair préfixé `gnodice:`, traduit tel quel par le site. |
| Événements on-chain | `GamePlaced`, `DiceRolled`, `GameSettled`, `GameRefunded`, `GameExpired`, `BankFunded`, `BankWithdrawn`, `BankrollLow`, `CircuitBreakerTripped`, `PauseChanged`, `CroupierChanged`, `PlayerBlocked`, `LimitsChanged`, `OwnershipProposed`, `OwnershipTransferred`. |
| Pause d'urgence | Manuelle (propriétaire) et automatique (coupe-circuit). En pause, les parties en cours se terminent quand même. |
| Banque | Réserve par partie, solde disponible, seuil d'alerte réglable. |
| États de transaction | Chaque partie a 6 états (en attente, tirée, gagnée, perdue, remboursée, expirée). Le site reprend tout seul une partie interrompue (onglet fermé, réseau coupé) et propose « Récupérer ma mise » ou « Encaisser » si besoin. |
| Fiabilité | Délais maximaux, nouveaux essais ciblés, opérations idempotentes, balayage de secours (à chaque tirage et par tâche planifiée), remboursement garanti au bout de 30 min. |
| Vérifiabilité | Le site recalcule chaque tirage avec la graine publiée. Gnoweb affiche la formule (`game/<numéro>`). Le JavaScript et le contrat sont vérifiés identiques par des vecteurs de test communs. |
| Performance | Gas mesuré sur chaîne réelle. Lectures gratuites (`qeval`) avec pagination (50 parties max). Plus de copie de structures : les historiques stockent des numéros. Le rafraîchissement s'arrête quand l'onglet est caché. |
| Tests | 26 tests contrat + 67 tests site/croupier + 3 tests de bout en bout. Commandes `npm run test:contract` et `npm run test:e2e`. |

---

## 3. Déployer sur Gno.land

### Méthode recommandée : depuis le site, avec Adena

Suis la section 4 du [README](README.md) :

1. déployer le contrat depuis `/admin` ;
2. créer un compte croupier dédié et lui envoyer 5 GNOT ;
3. ajouter `CROUPIER_MNEMONIC` et `CRON_SECRET` dans les variables Vercel, puis redéployer ;
4. cliquer « Utiliser ce croupier » ;
5. alimenter la banque.

### Méthode alternative : ligne de commande (`gnokey`)

Remplace `<owner>` et `<croupier>` par les noms de tes clés, `<adresse>` par l'adresse g1 du propriétaire.

```bash
# 0. Clés (une seule fois)
gnokey add <owner> --recover        # ta clé de propriétaire
gnokey add <croupier>               # NOUVELLE clé dédiée au croupier : note la phrase secrète

# 1. Mettre le bon chemin dans contract/gnodice/gnomod.toml :
#    module = "gno.land/r/<adresse>/gnodice"

# 2. Déployer le contrat (≈ 59 M de gas mesurés)
gnokey maketx addpkg \
  -pkgdir ./contract/gnodice \
  -pkgpath gno.land/r/<adresse>/gnodice \
  -gas-fee 1000000ugnot -gas-wanted 120000000 \
  -broadcast -chainid onyx-1 -remote https://rpc.onyx.testnets.gno.land:443 \
  <owner>

# 3. Désigner le croupier
gnokey maketx call -pkgpath gno.land/r/<adresse>/gnodice -func SetCroupier -args <adresse-croupier> \
  -gas-fee 100000ugnot -gas-wanted 15000000 \
  -broadcast -chainid onyx-1 -remote https://rpc.onyx.testnets.gno.land:443 \
  <owner>

# 4. Alimenter la banque (ici 100 GNOT)
gnokey maketx call -pkgpath gno.land/r/<adresse>/gnodice -func Fund -send 100000000ugnot \
  -gas-fee 100000ugnot -gas-wanted 15000000 \
  -broadcast -chainid onyx-1 -remote https://rpc.onyx.testnets.gno.land:443 \
  <owner>

# 5. Donner du gas au croupier (5 GNOT)
gnokey maketx send -to <adresse-croupier> -send 5000000ugnot \
  -gas-fee 100000ugnot -gas-wanted 2000000 \
  -broadcast -chainid onyx-1 -remote https://rpc.onyx.testnets.gno.land:443 \
  <owner>
```

Ensuite, côté Vercel :

- `NEXT_PUBLIC_GNODICE_REALM` = `gno.land/r/<adresse>/gnodice` (si ce n'est pas le chemin par défaut) ;
- `CROUPIER_MNEMONIC` = la phrase du croupier ;
- `CRON_SECRET` = un jeton aléatoire (`openssl rand -hex 32`) ;
- puis **Redeploy**.

Pour le mainnet, remplace `onyx-1` par `gnoland-1` et l'URL RPC par `https://rpc.gno.land:443`.

---

## 4. Checklist avant la mise en production

### Avant de déployer

- [ ] `npm test`, `npm run test:contract`, `npm run test:e2e` et `npm run build` passent.
- [ ] Le compte croupier est **dédié**, avec seulement le gas nécessaire (≤ 5 GNOT).
- [ ] `CROUPIER_MNEMONIC` et `CRON_SECRET` sont dans Vercel, **jamais** en `NEXT_PUBLIC_…` ni dans Git.
- [ ] Limites réglées dans `/admin` : gains max par jour adaptés à la banque (conseil : ≤ 50 % de la banque) et
      seuil d'alerte.

### Sur le testnet Onyx

- [ ] Une partie gagnée et une perdue jouées de bout en bout avec Adena, gains reçus.
- [ ] Le remboursement testé : croupier volontairement arrêté (`CROUPIER_MNEMONIC` vide), mise récupérée après 30 min.
- [ ] Le tableau de bord n'affiche aucune alerte critique.
- [ ] Un tirage vérifié à la main sur gnoweb (`/r/<adresse>/gnodice:game/<n>`).

### Avant le mainnet

- [ ] Relecture du contrat par un auditeur **indépendant**.
- [ ] Banque alimentée progressivement. Surveillance quotidienne pendant les premières semaines.
- [ ] Procédure d'urgence connue : « Mettre en pause » dans `/admin`, puis changer de croupier.

---

## 5. Comment les scores sont calculés

### Sécurité : 92 / 100

| Critère | Points | Pourquoi pas le maximum |
|---|---|---|
| Équité du hasard | 24 / 25 | Le jeu dépend du croupier pour *avancer* (pas pour le résultat). Le remboursement couvre ce cas. |
| Sécurité des fonds et comptabilité | 20 / 20 | |
| Contrôle des accès | 15 / 15 | |
| Résistance aux exploits (annulation, rejeu, devancement, courses) | 15 / 15 | |
| Sécurité opérationnelle | 11 / 15 | La clé du croupier est une clé « chaude » dans les variables Vercel. La limite d'appels est en mémoire (par instance). La CSP autorise les scripts en ligne. |
| Niveau de preuve | 7 / 10 | Pas encore d'essai sur Onyx avec Adena. Pas d'audit externe. |

### Architecture : 93 / 100

| Critère | Points | Pourquoi pas le maximum |
|---|---|---|
| Modularité et séparation | 20 / 20 | |
| Gestion des erreurs et des états | 14 / 15 | Un joueur qui change d'appareil entre la mise et la fin de la partie doit revenir sur le premier. |
| Observabilité | 14 / 15 | Pas d'alerte envoyée hors du site (e-mail, Discord). |
| Fiabilité | 18 / 20 | Sur l'offre gratuite de Vercel, la tâche planifiée ne tourne qu'une fois par jour (le balayage se fait aussi à chaque tirage). |
| Performance | 12 / 15 | Le gas du contrat pourrait encore baisser (moins d'arbres AVL par partie). Pas de cache partagé côté client. |
| Tests et documentation | 15 / 15 | |

### Pour dépasser 95

1. **Toi** : jouer et rembourser une partie sur Onyx avec Adena (checklist ci-dessus). Niveau de preuve : +2.
2. **Toi** : faire relire le contrat par un auditeur indépendant. Niveau de preuve : +1 à +3.
3. Mettre la clé du croupier dans un coffre-fort de clés (KMS) ou sur un petit serveur dédié, et une limite d'appels
   partagée (Upstash Redis). Sécurité opérationnelle : +2 à +3.
4. Passer Vercel en offre Pro pour un balayage chaque minute, et envoyer les alertes sur Discord ou par e-mail.
   Fiabilité et observabilité : +2.
