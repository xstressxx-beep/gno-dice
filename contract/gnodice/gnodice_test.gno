package gnodice

import (
	"chain"
	"chain/banker"
	"strconv"
	"strings"
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
	"gno.land/p/nt/urequire/v0"
)

var (
	testOwner = testutils.TestAddress("owner")
	alice     = testutils.TestAddress("alice")
	bob       = testutils.TestAddress("bob")
)

// --- outils de test ---
//
// Pour simuler « un utilisateur signe une transaction depuis son wallet », on
// appelle testing.SetRealm(testing.NewUserRealm(adresse)) juste avant l'appel
// au contrat, DANS LA MÊME FONCTION NOMMÉE : SetRealm ne vaut que pour la
// fonction où il est appelé, et il est ignoré dans une fonction anonyme
// (func() {...}). C'est pourquoi chaque scénario a sa petite fonction ci-dessous.

// resetState remet le jeu à zéro entre deux tests.
func resetState() {
	owner = testOwner
	paused = false
	players = avl.NewTree()
	recent = nil
	totalGames = 0
	totalWins = 0
	totalWagered = 0
	totalPaid = 0
	totalFunded = 0
}

func balanceOf(addr address) int64 {
	return banker.NewReadonlyBanker().GetCoin(addr, Denom)
}

func ugnot(amount int64) chain.Coins {
	return chain.Coins{{Denom, amount}}
}

// playAs simule un joueur qui appelle Play avec une mise.
// Sur la vraie chaîne, les GNOT envoyés arrivent dans la banque avant
// l'exécution de Play : on reproduit ça avec IssueCoins.
func playAs(cur realm, player address, bet int64, guess int) string {
	testing.SetOriginSend(ugnot(bet))
	testing.IssueCoins(realmAddr, ugnot(bet))
	testing.SetRealm(testing.NewUserRealm(player))
	return Play(cross(cur), guess)
}

// playWithCoins simule un appel à Play avec n'importe quelles pièces envoyées.
func playWithCoins(cur realm, player address, sent chain.Coins, guess int) {
	testing.SetOriginSend(sent)
	testing.SetRealm(testing.NewUserRealm(player))
	Play(cross(cur), guess)
}

// playFromContract simule un AUTRE contrat (ex. un contrat pirate) qui
// essaie d'appeler Play.
func playFromContract(cur realm) {
	testing.SetOriginSend(ugnot(MinBet))
	testing.IssueCoins(realmAddr, ugnot(MinBet))
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/attacker/proxy"))
	Play(cross(cur), 3)
}

func fundFromContract(cur realm) {
	testing.SetOriginSend(ugnot(MinBet))
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/attacker/proxy"))
	Fund(cross(cur))
}

func fundWithNothing(cur realm, from address) {
	testing.SetOriginSend(nil)
	testing.SetRealm(testing.NewUserRealm(from))
	Fund(cross(cur))
}

// drainBank vide la banque (via le propriétaire) pour partir d'un solde connu.
func drainBank(cur realm) {
	if bal := Bankroll(); bal > 0 {
		testing.SetOriginSend(nil)
		testing.SetRealm(testing.NewUserRealm(owner))
		Withdraw(cross(cur), bal)
	}
}

// fundBank ajoute des GNOT dans la banque, comme un vrai appel à Fund.
func fundBank(cur realm, amount int64) {
	testing.SetOriginSend(ugnot(amount))
	testing.IssueCoins(realmAddr, ugnot(amount))
	testing.SetRealm(testing.NewUserRealm(testOwner))
	Fund(cross(cur))
}

// Actions d'administration appelées par « caller ».
func setPausedAs(cur realm, caller address, value bool) {
	testing.SetOriginSend(nil)
	testing.SetRealm(testing.NewUserRealm(caller))
	SetPaused(cross(cur), value)
}

func withdrawAs(cur realm, caller address, amount int64) {
	testing.SetOriginSend(nil)
	testing.SetRealm(testing.NewUserRealm(caller))
	Withdraw(cross(cur), amount)
}

func transferOwnershipAs(cur realm, caller, newOwner address) {
	testing.SetOriginSend(nil)
	testing.SetRealm(testing.NewUserRealm(caller))
	TransferOwnership(cross(cur), newOwner)
}

// --- tests ---

func TestRealmAddressIsSet(t *testing.T) {
	// Note : dans l'environnement de test il n'y a pas de « déployeur », donc
	// init() ne peut pas enregistrer de propriétaire. Sur la vraie chaîne,
	// cur.Previous() dans init() est l'adresse qui déploie le contrat.
	uassert.True(t, realmAddr.IsValid(), "l'adresse du contrat doit être valide")
	uassert.Equal(t, chain.PackageAddress("gno.land/r/example/gnodice"), realmAddr)
}

func TestPlayRejectsInvalidGuess(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 100*UgnotPerGnot)

	msg := "gnodice: le chiffre doit être entre 1 et 6"
	uassert.AbortsWithMessage(t, cur, msg, func() { playAs(cur, alice, MinBet, 0) })
	uassert.AbortsWithMessage(t, cur, msg, func() { playAs(cur, alice, MinBet, 7) })
	uassert.AbortsWithMessage(t, cur, msg, func() { playAs(cur, alice, MinBet, -1) })
	uassert.Equal(t, 0, totalGames)
}

func TestPlayRejectsInvalidBet(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 100*UgnotPerGnot)

	msg := "gnodice: la mise doit être entre 1 et 10 GNOT"
	uassert.AbortsWithMessage(t, cur, msg, func() { playAs(cur, alice, MinBet-1, 3) })
	uassert.AbortsWithMessage(t, cur, msg, func() { playAs(cur, alice, MaxBet+1, 3) })

	// Mauvaise monnaie, plusieurs monnaies à la fois, ou rien envoyé.
	wrongCoin := "gnodice: envoie ta mise en GNOT uniquement"
	uassert.AbortsWithMessage(t, cur, wrongCoin, func() { playWithCoins(cur, alice, chain.Coins{{"foo", MinBet}}, 3) })
	uassert.AbortsWithMessage(t, cur, wrongCoin, func() { playWithCoins(cur, alice, chain.Coins{{"foo", 1}, {Denom, MinBet}}, 3) })
	uassert.AbortsWithMessage(t, cur, wrongCoin, func() { playWithCoins(cur, alice, nil, 3) })
	uassert.Equal(t, 0, totalGames)
}

func TestPlayOnlyFromWallet(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 100*UgnotPerGnot)

	// Un autre contrat (ex. un contrat pirate) ne peut pas appeler Play ni Fund.
	uassert.AbortsWithMessage(t, cur, "gnodice: Play doit être appelé directement depuis un wallet", func() { playFromContract(cur) })
	uassert.AbortsWithMessage(t, cur, "gnodice: Fund doit être appelé directement depuis un wallet", func() { fundFromContract(cur) })
	uassert.Equal(t, 0, totalGames)
}

func TestPlayNeedsEnoughBankroll(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	uassert.Equal(t, int64(0), Bankroll())
	uassert.Equal(t, int64(0), MaxCoverableBet())

	// Banque vide : après réception de la mise (10 GNOT) elle ne peut pas payer 50 GNOT.
	uassert.AbortsWithMessage(t, cur, "gnodice: la banque ne peut pas couvrir ce gain, essaie une mise plus petite", func() {
		playAs(cur, alice, 10*UgnotPerGnot, 3)
	})

	// Dans ce test, la mise refusée reste dans la banque (sur la vraie chaîne
	// la transaction serait annulée). On repart donc d'une banque vide, puis on
	// met exactement 40 GNOT : avec la mise de 10, on atteint les 50 nécessaires.
	drainBank(cur)
	fundBank(cur, 40*UgnotPerGnot)
	uassert.Equal(t, 10*UgnotPerGnot, MaxCoverableBet())
	uassert.NotAborts(t, cur, func() { playAs(cur, alice, 10*UgnotPerGnot, 3) })
	uassert.Equal(t, 1, totalGames)
}

func TestPlayRecordsGame(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 100*UgnotPerGnot)

	bankBefore := Bankroll()
	aliceBefore := balanceOf(alice)
	res := playAs(cur, alice, 2*UgnotPerGnot, 3)

	p := getPlayer(alice)
	urequire.True(t, p != nil, "le joueur doit être enregistré")
	urequire.Equal(t, 1, len(p.History))

	g := p.History[0]
	uassert.Equal(t, 1, g.ID)
	uassert.Equal(t, alice, g.Player)
	uassert.Equal(t, 3, g.Guess)
	uassert.Equal(t, 2*UgnotPerGnot, g.Bet)
	uassert.True(t, g.Roll >= 1 && g.Roll <= 6, "le dé doit être entre 1 et 6")
	uassert.Equal(t, g.Roll == 3, g.Won)
	if g.Won {
		uassert.Equal(t, 10*UgnotPerGnot, g.Payout)
	} else {
		uassert.Equal(t, int64(0), g.Payout)
	}
	uassert.Equal(t, "roll="+strconv.Itoa(g.Roll)+";won="+strconv.FormatBool(g.Won)+";payout="+strconv.FormatInt(g.Payout, 10), res)

	// L'argent a bien bougé : la banque garde la mise et paie le gain éventuel.
	uassert.Equal(t, bankBefore+2*UgnotPerGnot-g.Payout, Bankroll())
	uassert.Equal(t, aliceBefore+g.Payout, balanceOf(alice))

	uassert.Equal(t, 1, p.Played)
	uassert.Equal(t, 2*UgnotPerGnot, p.Wagered)
	uassert.Equal(t, 1, len(recent))
	uassert.Equal(t, 1, totalGames)
	uassert.Equal(t, 2*UgnotPerGnot, totalWagered)
}

func TestCooldownTenMinutes(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 100*UgnotPerGnot)

	playAs(cur, alice, MinBet, 1)

	// Tout de suite après : refusé.
	uassert.AbortsWithMessage(t, cur, "gnodice: attends encore 10 min 0 s avant de rejouer", func() {
		playAs(cur, alice, MinBet, 1)
	})

	// Un autre joueur n'est pas bloqué par le cooldown d'Alice.
	uassert.NotAborts(t, cur, func() { playAs(cur, bob, MinBet, 1) })

	// 5 minutes plus tard (60 blocs de 5 secondes) : toujours refusé.
	testing.SkipHeights(60)
	uassert.AbortsWithMessage(t, cur, "gnodice: attends encore 5 min 0 s avant de rejouer", func() {
		playAs(cur, alice, MinBet, 1)
	})

	// 9 min 55 s après : encore 5 secondes à attendre.
	testing.SkipHeights(59)
	uassert.AbortsWithMessage(t, cur, "gnodice: attends encore 5 s avant de rejouer", func() {
		playAs(cur, alice, MinBet, 1)
	})

	// Pile 10 minutes après : autorisé.
	testing.SkipHeights(1)
	uassert.NotAborts(t, cur, func() { playAs(cur, alice, MinBet, 1) })
	uassert.Equal(t, 2, getPlayer(alice).Played)
}

func TestWinPaysFiveTimesAndLossPaysNothing(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 1000*UgnotPerGnot)

	wins, losses := 0, 0
	for i := 0; i < 40; i++ {
		player := testutils.TestAddress("player" + strconv.Itoa(i))
		bet := int64(1+i%10) * UgnotPerGnot
		bankBefore := Bankroll()
		playerBefore := balanceOf(player)

		playAs(cur, player, bet, 6)
		g := getPlayer(player).History[0]

		if g.Won {
			wins++
			uassert.Equal(t, 6, g.Roll)
			uassert.Equal(t, bet*5, g.Payout, "un gain vaut 5 fois la mise")
			uassert.Equal(t, playerBefore+bet*5, balanceOf(player))
		} else {
			losses++
			uassert.NotEqual(t, 6, g.Roll)
			uassert.Equal(t, int64(0), g.Payout)
			uassert.Equal(t, playerBefore, balanceOf(player))
		}
		uassert.Equal(t, bankBefore+bet-g.Payout, Bankroll())
	}
	uassert.True(t, wins > 0, "il faut au moins une victoire dans l'échantillon")
	uassert.True(t, losses > 0, "il faut au moins une défaite dans l'échantillon")
	uassert.Equal(t, wins, totalWins)
	uassert.Equal(t, 40, totalGames)
	// L'historique global ne garde que les 10 dernières parties.
	uassert.Equal(t, HistorySize, len(recent))
	uassert.Equal(t, 40, recent[len(recent)-1].ID)
}

func TestHistoryKeepsLastTenGames(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 1000*UgnotPerGnot)

	for i := 0; i < 12; i++ {
		playAs(cur, bob, MinBet, 1+i%6)
		testing.SkipHeights(120) // 10 minutes
	}

	p := getPlayer(bob)
	uassert.Equal(t, 12, p.Played)
	urequire.Equal(t, HistorySize, len(p.History))
	uassert.Equal(t, 3, p.History[0].ID, "les 2 plus anciennes parties sont supprimées")
	uassert.Equal(t, 12, p.History[HistorySize-1].ID)

	// Le JSON renvoie les parties de la plus récente à la plus ancienne.
	js := GetPlayerJSON(bob.String())
	uassert.Equal(t, HistorySize, strings.Count(js, `"id":`))
	uassert.True(t, strings.Contains(js, `"history":[{"id":12,`), "la partie la plus récente doit être en premier")
	uassert.True(t, strings.Contains(js, `"played":12,`))
	uassert.True(t, strings.HasSuffix(js, "}]}"))
}

func TestOwnerActions(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 50*UgnotPerGnot)

	// Alice n'est pas propriétaire.
	ownerOnly := "gnodice: action réservée au propriétaire du contrat"
	uassert.AbortsWithMessage(t, cur, ownerOnly, func() { setPausedAs(cur, alice, true) })
	uassert.AbortsWithMessage(t, cur, ownerOnly, func() { withdrawAs(cur, alice, MinBet) })
	uassert.AbortsWithMessage(t, cur, ownerOnly, func() { transferOwnershipAs(cur, alice, alice) })

	// Pause : plus personne ne peut jouer.
	setPausedAs(cur, testOwner, true)
	uassert.AbortsWithMessage(t, cur, "gnodice: le jeu est en pause", func() { playAs(cur, alice, MinBet, 2) })
	setPausedAs(cur, testOwner, false)
	uassert.NotAborts(t, cur, func() { playAs(cur, alice, MinBet, 2) })

	// Retrait : pas plus que le solde, et les GNOT arrivent chez le propriétaire.
	uassert.AbortsWithMessage(t, cur, "gnodice: la banque ne contient pas assez de GNOT", func() {
		withdrawAs(cur, testOwner, Bankroll()+1)
	})
	uassert.AbortsWithMessage(t, cur, "gnodice: montant invalide", func() { withdrawAs(cur, testOwner, 0) })
	ownerBefore := balanceOf(testOwner)
	bankBefore := Bankroll()
	withdrawAs(cur, testOwner, 5*UgnotPerGnot)
	uassert.Equal(t, ownerBefore+5*UgnotPerGnot, balanceOf(testOwner))
	uassert.Equal(t, bankBefore-5*UgnotPerGnot, Bankroll())

	// Transfert de propriété : l'ancien propriétaire perd ses droits.
	transferOwnershipAs(cur, testOwner, alice)
	uassert.Equal(t, alice, Owner())
	uassert.AbortsWithMessage(t, cur, ownerOnly, func() { setPausedAs(cur, testOwner, true) })
	uassert.NotAborts(t, cur, func() { setPausedAs(cur, alice, false) })
}

func TestFund(cur realm, t *testing.T) {
	resetState()
	fundBank(cur, 7*UgnotPerGnot)
	uassert.Equal(t, 7*UgnotPerGnot, totalFunded)

	uassert.AbortsWithMessage(t, cur, "gnodice: envoie des GNOT avec la transaction pour alimenter la banque", func() {
		fundWithNothing(cur, alice)
	})
}

func TestRollDieIsFair(t *testing.T) {
	counts := make([]int, DieFaces+1)
	for i := 0; i < 600; i++ {
		r := rollDie(alice, int64(i))
		urequire.True(t, r >= 1 && r <= DieFaces, "résultat hors limites : "+strconv.Itoa(r))
		counts[r]++
	}
	// 600 lancers : on attend environ 100 fois chaque face.
	for face := 1; face <= DieFaces; face++ {
		uassert.True(t, counts[face] > 60 && counts[face] < 140,
			"face "+strconv.Itoa(face)+" sortie "+strconv.Itoa(counts[face])+" fois")
	}
}

func TestReadFunctions(cur realm, t *testing.T) {
	resetState()
	drainBank(cur)
	fundBank(cur, 100*UgnotPerGnot)
	playAs(cur, alice, 3*UgnotPerGnot, 4)

	uassert.Equal(t, `{"error":"adresse invalide"}`, GetPlayerJSON("pas-une-adresse"))

	// Joueur inconnu : tout à zéro, historique vide.
	unknown := GetPlayerJSON(bob.String())
	uassert.True(t, strings.Contains(unknown, `"played":0,`), unknown)
	uassert.True(t, strings.Contains(unknown, `"cooldownRemaining":0,`), unknown)
	uassert.True(t, strings.HasSuffix(unknown, `"history":[]}`), unknown)

	// Alice vient de jouer : 10 minutes d'attente.
	js := GetPlayerJSON(alice.String())
	uassert.True(t, strings.Contains(js, `"cooldownRemaining":600,`), js)
	uassert.True(t, strings.Contains(js, `"guess":4,`), js)
	uassert.True(t, strings.Contains(js, `"bet":3000000,`), js)

	info := GetInfoJSON()
	for _, key := range []string{`"owner":"`, `"realm":"`, `"paused":false`, `"bankroll":`, `"maxCoverableBet":10000000`,
		`"minBet":1000000`, `"maxBet":10000000`, `"multiplier":5`, `"cooldown":600`, `"totalGames":1`, `"recent":[{"id":1,`} {
		uassert.True(t, strings.Contains(info, key), "clé manquante "+key+" dans "+info)
	}

	home := Render("")
	uassert.True(t, strings.Contains(home, "# 🎲 GNO-DICE"), home)
	uassert.True(t, strings.Contains(home, "| 1 |"), home)
	uassert.True(t, strings.Contains(Render("player/nimportequoi"), "Adresse invalide"))
	uassert.True(t, strings.Contains(Render("player/"+bob.String()), "Aucune partie"))
	uassert.True(t, strings.Contains(Render("player/"+alice.String()), "3 GNOT | 4 |"))
}

func TestFormatHelpers(t *testing.T) {
	uassert.Equal(t, "0", formatGnot(0))
	uassert.Equal(t, "1", formatGnot(1_000_000))
	uassert.Equal(t, "1.5", formatGnot(1_500_000))
	uassert.Equal(t, "0.000001", formatGnot(1))
	uassert.Equal(t, "10.25", formatGnot(10_250_000))
	uassert.Equal(t, "-2", formatGnot(-2_000_000))

	uassert.Equal(t, "45 s", formatDuration(45))
	uassert.Equal(t, "7 min 12 s", formatDuration(432))

	list := []Game{}
	for i := 1; i <= 15; i++ {
		list = pushGame(list, Game{ID: i})
	}
	uassert.Equal(t, HistorySize, len(list))
	uassert.Equal(t, 6, list[0].ID)
	uassert.Equal(t, 15, list[HistorySize-1].ID)
}
