package gnodice

import (
	"chain"
	"chain/banker"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
	"gno.land/p/nt/urequire/v0"
)

var (
	testOwner    = testutils.TestAddress("owner")
	testCroupier = testutils.TestAddress("croupier")
	alice        = testutils.TestAddress("alice")
	bob          = testutils.TestAddress("bob")
)

// =============================================================================
// Outils de test
//
// Pour simuler « un utilisateur signe une transaction depuis son wallet », on
// appelle testing.SetRealm(testing.NewUserRealm(adresse)) juste avant l'appel
// au contrat, DANS LA MÊME FONCTION NOMMÉE : SetRealm ne vaut que pour la
// fonction où il est appelé (pas dans une fonction anonyme). D'où une petite
// fonction par type d'appel ci-dessous.
// =============================================================================

// resetState remet le jeu à zéro entre deux tests.
func resetState(cur realm) {
	owner = testOwner
	pendingOwner = ""
	croupier = testCroupier
	paused = false
	games = avl.NewTree()
	openGames = avl.NewTree()
	players = avl.NewTree()
	blocked = avl.NewTree()
	recent = nil
	reserved = 0
	totalGames, totalWagered, totalPaid, totalFunded, totalWithdrawn = 0, 0, 0, 0, 0
	totalWins, totalLosses, totalRefunded, totalExpired = 0, 0, 0, 0
	dailyPayoutLimit = DefaultDailyPayoutLimit
	lowBankroll = DefaultLowBankroll
	payoutDay, payoutToday = 0, 0
	drainBank(cur)
}

func balanceOf(addr address) int64 {
	return banker.NewReadonlyBanker().GetCoin(addr, Denom)
}

func ugnot(amount int64) chain.Coins {
	return chain.Coins{{Denom, amount}}
}

// salt : un secret de 32 octets déterministe (hexadécimal), différent par étiquette.
func salt(label string) string {
	sum := sha256.Sum256([]byte("salt|" + label))
	return hex.EncodeToString(sum[:])
}

// seed : une graine de croupier déterministe.
func seed(label string) string {
	sum := sha256.Sum256([]byte("seed|" + label))
	return hex.EncodeToString(sum[:])
}

// seedFor cherche une graine qui donne `want` pour cette partie (les tests
// choisissent ainsi l'issue ; un vrai croupier ne connaît pas le chiffre caché).
func seedFor(commitment string, id int64, want int) string {
	for i := 0; i < 1000; i++ {
		s := seed(commitment + strconv.Itoa(i))
		if rollFromSeed(s, commitment, id) == want {
			return s
		}
	}
	panic("aucune graine trouvée")
}

// playAs : un joueur mise `bet` sur un chiffre caché. Sur la vraie chaîne, les
// GNOT envoyés arrivent dans la banque avant l'exécution : IssueCoins.
func playAs(cur realm, player address, bet int64, commitment string) string {
	testing.SetOriginSend(ugnot(bet))
	testing.IssueCoins(realmAddr, ugnot(bet))
	testing.SetRealm(testing.NewUserRealm(player))
	return Play(cross(cur), commitment)
}

// play : mise + empreinte calculée pour (player, guess, salt(label)). Renvoie le numéro.
func play(cur realm, player address, bet int64, guess int, label string) int64 {
	res := playAs(cur, player, bet, Commitment(player, guess, salt(label)))
	id, _ := strconv.ParseInt(strings.TrimPrefix(res, "id="), 10, 64)
	return id
}

func playWithCoins(cur realm, player address, sent chain.Coins, commitment string) {
	testing.SetOriginSend(sent)
	testing.SetRealm(testing.NewUserRealm(player))
	Play(cross(cur), commitment)
}

// Un autre contrat (ex. un contrat pirate) essaie d'appeler Play.
func playFromContract(cur realm, commitment string) {
	testing.SetOriginSend(ugnot(MinBet))
	testing.IssueCoins(realmAddr, ugnot(MinBet))
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/attacker/proxy"))
	Play(cross(cur), commitment)
}

// resolveAs : `caller` essaie de tirer le dé de la partie `id` avec la graine `s`.
func resolveAs(cur realm, caller address, id int64, s string) {
	testing.SetOriginSend(nil)
	testing.SetRealm(testing.NewUserRealm(caller))
	Resolve(cross(cur), id, s)
}

// resolveTo : le croupier tire le dé en choisissant (pour le test) le résultat.
func resolveTo(cur realm, id int64, roll int) {
	g := getGame(id)
	resolveAs(cur, testCroupier, id, seedFor(g.Commitment, id, roll))
}

func revealAs(cur realm, caller address, id int64, guess int, saltHex string) string {
	testing.SetOriginSend(nil)
	testing.SetRealm(testing.NewUserRealm(caller))
	return Reveal(cross(cur), id, guess, saltHex)
}

func refundAs(cur realm, caller address, id int64) {
	testing.SetOriginSend(nil)
	testing.SetRealm(testing.NewUserRealm(caller))
	Refund(cross(cur), id)
}

func expireAs(cur realm, caller address, id int64) {
	testing.SetOriginSend(nil)
	testing.SetRealm(testing.NewUserRealm(caller))
	Expire(cross(cur), id)
}

func fundBank(cur realm, amount int64) {
	testing.SetOriginSend(ugnot(amount))
	testing.IssueCoins(realmAddr, ugnot(amount))
	testing.SetRealm(testing.NewUserRealm(testOwner))
	Fund(cross(cur))
}

func fundFromContract(cur realm) {
	testing.SetOriginSend(ugnot(MinBet))
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/attacker/proxy"))
	Fund(cross(cur))
}

// drainBank vide la banque (via le propriétaire) pour partir d'un solde connu.
func drainBank(cur realm) {
	if a := available(); a > 0 {
		testing.SetOriginSend(nil)
		testing.SetRealm(testing.NewUserRealm(owner))
		Withdraw(cross(cur), a)
	}
	totalWithdrawn = 0
}

func setPausedAs(cur realm, caller address, value bool) {
	testing.SetRealm(testing.NewUserRealm(caller))
	SetPaused(cross(cur), value)
}

func withdrawAs(cur realm, caller address, amount int64) {
	testing.SetRealm(testing.NewUserRealm(caller))
	Withdraw(cross(cur), amount)
}

func setCroupierAs(cur realm, caller, addr address) {
	testing.SetRealm(testing.NewUserRealm(caller))
	SetCroupier(cross(cur), addr)
}

func setBlockedAs(cur realm, caller, addr address, value bool) {
	testing.SetRealm(testing.NewUserRealm(caller))
	SetBlocked(cross(cur), addr, value)
}

func setLimitsAs(cur realm, caller address, daily, low int64) {
	testing.SetRealm(testing.NewUserRealm(caller))
	SetLimits(cross(cur), daily, low)
}

func transferOwnershipAs(cur realm, caller, newOwner address) {
	testing.SetRealm(testing.NewUserRealm(caller))
	TransferOwnership(cross(cur), newOwner)
}

func acceptOwnershipAs(cur realm, caller address) {
	testing.SetRealm(testing.NewUserRealm(caller))
	AcceptOwnership(cross(cur))
}

// skip fait avancer le temps (5 s par bloc dans l'environnement de test).
func skip(seconds int64) {
	testing.SkipHeights(seconds/5 + 1)
}

// =============================================================================
// Équité : empreinte et tirage
// =============================================================================

func TestRealmAddressIsSet(t *testing.T) {
	uassert.True(t, realmAddr.IsValid(), "l'adresse du contrat doit être valide")
	uassert.Equal(t, chain.PackageAddress("gno.land/r/example/gnodice"), realmAddr)
}

func TestCommitmentAndRoll(t *testing.T) {
	c := Commitment(alice, 3, salt("a"))
	uassert.Equal(t, 64, len(c))
	uassert.True(t, isHex64(c))
	// Déterministe, et lié à l'adresse, au chiffre et au secret
	uassert.Equal(t, c, Commitment(alice, 3, salt("a")))
	uassert.NotEqual(t, c, Commitment(bob, 3, salt("a")))
	uassert.NotEqual(t, c, Commitment(alice, 4, salt("a")))
	uassert.NotEqual(t, c, Commitment(alice, 3, salt("b")))

	// Le tirage public RollFor donne le même résultat que le contrat
	s := seed("x")
	r := rollFromSeed(s, c, 7)
	uassert.True(t, r >= 1 && r <= 6)
	uassert.Equal(t, r, RollFor(s, c, 7))
	uassert.Equal(t, 0, RollFor("pas-hex", c, 7))

	// Validation hexadécimale stricte
	uassert.False(t, isHex64(""))
	uassert.False(t, isHex64(strings.Repeat("A", 64)), "majuscules refusées")
	uassert.False(t, isHex64(strings.Repeat("a", 63)))
	uassert.False(t, isHex64(strings.Repeat("g", 64)))
}

// Vecteurs de référence partagés avec le site (src/lib/fairness.test.ts) :
// le JavaScript et le contrat doivent calculer exactement la même chose.
func TestCrossLanguageVectors(t *testing.T) {
	uassert.Equal(t, "g1v9kxjcm9ta047h6lta047h6lta047h6lzd40gh", alice.String())
	s := "2f683125c961cde12579ea12f7ae964c2cfe0d21bb3ca0ab90aeb92528d00575"
	uassert.Equal(t, s, salt("vec"))
	c := Commitment(alice, 3, s)
	uassert.Equal(t, "b0ee524a518406c9ca0b10d37962bdd2eb817023959d4896aab9e599afb9e7f2", c)
	sd := "f614ae04a1e7a9183914964efe09a9a72bb9229c1ff3ffff4a935faa2c5761e8"
	uassert.Equal(t, sd, seed("vec"))
	uassert.Equal(t, 3, rollFromSeed(sd, c, 42))
}

// Le tirage est uniforme : 60 000 tirages, chaque face entre 9 500 et 10 500.
func TestRollIsUniform(t *testing.T) {
	counts := make([]int, DieFaces+1)
	c := Commitment(alice, 1, salt("u"))
	for i := 0; i < 60_000; i++ {
		counts[rollFromSeed(seed(strconv.Itoa(i)), c, int64(i))]++
	}
	for face := 1; face <= DieFaces; face++ {
		uassert.True(t, counts[face] > 9_500 && counts[face] < 10_500, "face "+strconv.Itoa(face)+" : "+strconv.Itoa(counts[face]))
	}
}

// =============================================================================
// Parties normales
// =============================================================================

func TestFullGameWin(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	bankBefore := Bankroll()
	aliceBefore := balanceOf(alice)

	id := play(cur, alice, 2*UgnotPerGnot, 4, "w")
	uassert.Equal(t, int64(1), id)
	g := getGame(id)
	uassert.Equal(t, int(StatusPending), int(g.Status))
	uassert.Equal(t, 0, g.Roll, "aucun dé tant que le croupier n'a pas tiré")
	uassert.Equal(t, 0, g.Guess, "le chiffre reste caché")
	uassert.Equal(t, 10*UgnotPerGnot, reserved, "la banque réserve 5 x la mise")

	resolveTo(cur, id, 4)
	uassert.Equal(t, int(StatusRolled), int(g.Status))
	uassert.Equal(t, 4, g.Roll)
	uassert.Equal(t, g.Roll, RollFor(g.Seed, g.Commitment, g.ID), "tirage vérifiable par tous")

	res := revealAs(cur, alice, id, 4, salt("w"))
	uassert.Equal(t, "roll=4;won=true;payout=10000000", res)
	uassert.Equal(t, int(StatusWon), int(g.Status))
	uassert.Equal(t, int64(0), reserved)
	uassert.Equal(t, aliceBefore+10*UgnotPerGnot, balanceOf(alice), "le joueur reçoit 5 x sa mise")
	uassert.Equal(t, bankBefore+2*UgnotPerGnot-10*UgnotPerGnot, Bankroll())

	p := getPlayer(alice)
	uassert.Equal(t, 1, p.Played)
	uassert.Equal(t, 1, p.Wins)
	uassert.Equal(t, 0, p.Open)
	uassert.Equal(t, 1, totalWins)
	uassert.Equal(t, 10*UgnotPerGnot, totalPaid)
	uassert.Equal(t, 1, len(recent))
	uassert.Equal(t, 0, openGames.Size())
}

func TestFullGameLoss(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	aliceBefore := balanceOf(alice)

	id := play(cur, alice, 3*UgnotPerGnot, 2, "l")
	resolveTo(cur, id, 5)
	res := revealAs(cur, alice, id, 2, salt("l"))

	uassert.Equal(t, "roll=5;won=false;payout=0", res)
	uassert.Equal(t, int(StatusLost), int(getGame(id).Status))
	uassert.Equal(t, aliceBefore, balanceOf(alice), "rien n'est versé")
	uassert.Equal(t, 103*UgnotPerGnot, Bankroll(), "la mise reste dans la banque")
	uassert.Equal(t, int64(0), reserved)
	uassert.Equal(t, 1, totalLosses)
}

func TestCooldownTenMinutes(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)

	play(cur, alice, MinBet, 1, "c1")
	uassert.AbortsContains(t, cur, "avant de rejouer", func() { play(cur, alice, MinBet, 1, "c2") })
	// Un autre joueur n'est pas concerné
	uassert.NotAborts(t, cur, func() { play(cur, bob, MinBet, 1, "c3") })

	skip(CooldownSeconds - 30)
	uassert.AbortsContains(t, cur, "avant de rejouer", func() { play(cur, alice, MinBet, 1, "c4") })
	skip(60)
	uassert.NotAborts(t, cur, func() { play(cur, alice, MinBet, 1, "c5") })
}

func TestHistoryKeepsLastTen(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 500*UgnotPerGnot)
	for i := 0; i < 13; i++ {
		id := play(cur, alice, MinBet, 1, "h"+strconv.Itoa(i))
		resolveTo(cur, id, 2)
		revealAs(cur, alice, id, 1, salt("h"+strconv.Itoa(i)))
		skip(CooldownSeconds)
	}
	p := getPlayer(alice)
	uassert.Equal(t, 13, p.Played)
	uassert.Equal(t, HistorySize, len(p.History))
	uassert.Equal(t, int64(4), p.History[0], "la plus ancienne gardée est la n° 4")
	uassert.Equal(t, int64(13), p.History[HistorySize-1])
	uassert.Equal(t, HistorySize, len(recent))
}

// =============================================================================
// Sécurité : chaque test correspond à une attaque du rapport d'audit
// =============================================================================

// [C-1] Annuler la transaction quand on perd / prédire le dé avant de miser.
// Play ne tire plus le dé : rien à prédire ni à annuler au moment de miser.
// Le joueur ne peut pas tirer son propre dé, même avec un script.
func TestSecurityNoOutcomeAtPlayTime(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)

	res := playAs(cur, alice, MaxBet, Commitment(alice, 6, salt("x")))
	uassert.Equal(t, "id=1", res, "Play ne renvoie aucun résultat")
	uassert.Equal(t, 0, getGame(1).Roll)

	uassert.AbortsWithMessage(t, cur, "gnodice: seul le croupier peut tirer les dés", func() { resolveAs(cur, alice, 1, seed("a")) })
	uassert.AbortsWithMessage(t, cur, "gnodice: seul le croupier peut tirer les dés", func() { resolveAs(cur, testOwner, 1, seed("a")) })
}

// [C-2] Appeler Play depuis un contrat ou un script MsgRun pour détourner la mise.
func TestSecurityPlayOnlyFromWallet(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	c := Commitment(alice, 1, salt("s"))
	msg := "gnodice: Play doit être appelé directement depuis un wallet"
	uassert.AbortsWithMessage(t, cur, msg, func() { playFromContract(cur, c) })
	// Un script MsgRun garde l'adresse du joueur (IsUser) mais n'est PAS un appel
	// direct (IsUserCall) : c'est pourquoi Play, Fund et Resolve exigent IsUserCall.
	uassert.AbortsWithMessage(t, cur, "gnodice: Fund doit être appelé directement depuis un wallet", func() { fundFromContract(cur) })
	uassert.Equal(t, int64(0), totalGames)
}

// [H-1] Mises invalides : 0, négatives, trop grosses, mauvaise monnaie, plusieurs monnaies.
func TestSecurityInvalidBets(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	c := Commitment(alice, 1, salt("b"))

	rangeMsg := "gnodice: la mise doit être entre 1 et 10 GNOT"
	uassert.AbortsWithMessage(t, cur, rangeMsg, func() { playAs(cur, alice, MinBet-1, c) })
	uassert.AbortsWithMessage(t, cur, rangeMsg, func() { playAs(cur, alice, MaxBet+1, c) })
	coinMsg := "gnodice: envoie ta mise en GNOT uniquement"
	uassert.AbortsWithMessage(t, cur, coinMsg, func() { playWithCoins(cur, alice, chain.Coins{{"foo", MinBet}}, c) })
	uassert.AbortsWithMessage(t, cur, coinMsg, func() { playWithCoins(cur, alice, chain.Coins{{"foo", 1}, {Denom, MinBet}}, c) })
	uassert.AbortsWithMessage(t, cur, coinMsg, func() { playWithCoins(cur, alice, nil, c) })
	uassert.AbortsWithMessage(t, cur, rangeMsg, func() { playWithCoins(cur, alice, chain.Coins{{Denom, 0}}, c) })

	badCommit := "gnodice: empreinte invalide (64 caractères hexadécimaux attendus)"
	uassert.AbortsWithMessage(t, cur, badCommit, func() { playAs(cur, alice, MinBet, "") })
	uassert.AbortsWithMessage(t, cur, badCommit, func() { playAs(cur, alice, MinBet, "3") })
	uassert.AbortsWithMessage(t, cur, badCommit, func() { playAs(cur, alice, MinBet, `"},{"x":"`+strings.Repeat("a", 54)) })
	uassert.Equal(t, int64(0), totalGames)
}

// [H-2] Gagner sans avoir gagné : mauvais secret, mauvais chiffre, secret faible, rejouer une révélation.
func TestSecurityRevealChecks(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	id := play(cur, alice, MinBet, 3, "r")

	uassert.AbortsWithMessage(t, cur, "gnodice: cette partie ne peut pas être dévoilée maintenant", func() { revealAs(cur, alice, id, 3, salt("r")) })
	resolveTo(cur, id, 6)

	mismatch := "gnodice: le chiffre ou le secret ne correspond pas à l'empreinte"
	// Changer de chiffre après avoir vu le dé (6) : impossible
	uassert.AbortsWithMessage(t, cur, mismatch, func() { revealAs(cur, alice, id, 6, salt("r")) })
	uassert.AbortsWithMessage(t, cur, mismatch, func() { revealAs(cur, alice, id, 3, salt("autre")) })
	uassert.AbortsWithMessage(t, cur, "gnodice: secret invalide (64 caractères hexadécimaux attendus)", func() { revealAs(cur, alice, id, 3, "abc") })
	uassert.AbortsWithMessage(t, cur, "gnodice: le chiffre doit être entre 1 et 6", func() { revealAs(cur, alice, id, 0, salt("r")) })
	uassert.AbortsWithMessage(t, cur, "gnodice: le chiffre doit être entre 1 et 6", func() { revealAs(cur, alice, id, 7, salt("r")) })

	// Un tiers peut dévoiler (le service du site) : le résultat reste celui du joueur
	uassert.Equal(t, "roll=6;won=false;payout=0", revealAs(cur, bob, id, 3, salt("r")))
	// Deuxième révélation : refusée (pas de double paiement)
	uassert.AbortsWithMessage(t, cur, "gnodice: cette partie ne peut pas être dévoilée maintenant", func() { revealAs(cur, alice, id, 3, salt("r")) })
	uassert.AbortsWithMessage(t, cur, "gnodice: partie introuvable", func() { revealAs(cur, alice, 999, 3, salt("r")) })
}

// [H-3] Copier l'empreinte d'un autre joueur pour profiter de sa révélation.
func TestSecurityCommitmentBoundToPlayer(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 200*UgnotPerGnot)
	aliceCommit := Commitment(alice, 2, salt("victim"))
	victim := int64(1)
	playAs(cur, alice, MinBet, aliceCommit)
	playAs(cur, bob, MaxBet, aliceCommit) // bob copie l'empreinte (visible dans la transaction d'alice)
	resolveTo(cur, victim, 2)
	resolveTo(cur, 2, 2)
	revealAs(cur, alice, victim, 2, salt("victim")) // le secret d'alice devient public

	// Bob réutilise le chiffre et le secret d'alice : refusé, l'empreinte est liée à l'adresse
	uassert.AbortsWithMessage(t, cur, "gnodice: le chiffre ou le secret ne correspond pas à l'empreinte", func() {
		revealAs(cur, bob, 2, 2, salt("victim"))
	})
}

// [H-4] Tirage tardif et remboursement : les deux fenêtres ne se chevauchent jamais.
func TestSecurityResolveRefundWindows(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	aliceBefore := balanceOf(alice)
	id := play(cur, alice, 4*UgnotPerGnot, 1, "rf")

	uassert.AbortsContains(t, cur, "pour tirer le dé", func() { refundAs(cur, alice, id) })
	skip(ResolveTimeout)
	uassert.AbortsWithMessage(t, cur, "gnodice: délai de tirage dépassé, la partie doit être remboursée", func() { resolveTo(cur, id, 1) })

	refundAs(cur, bob, id) // n'importe qui peut déclencher : l'argent va au joueur
	uassert.Equal(t, int(StatusRefunded), int(getGame(id).Status))
	uassert.Equal(t, aliceBefore+4*UgnotPerGnot, balanceOf(alice))
	uassert.Equal(t, int64(0), reserved)
	uassert.Equal(t, int64(0), totalWagered, "une mise remboursée ne compte pas")
	uassert.AbortsContains(t, cur, "seule une partie en attente", func() { refundAs(cur, alice, id) })
}

// [M-1] Ne jamais dévoiler une partie perdue pour bloquer la réserve : elle expire et compte perdue.
func TestSecurityExpire(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	id := play(cur, alice, MinBet, 1, "e")
	resolveTo(cur, id, 3)

	uassert.AbortsWithMessage(t, cur, "gnodice: le joueur peut encore dévoiler son chiffre", func() { expireAs(cur, bob, id) })
	skip(RevealWindow)
	uassert.AbortsWithMessage(t, cur, "gnodice: délai dépassé, la partie a expiré", func() { revealAs(cur, alice, id, 1, salt("e")) })
	expireAs(cur, bob, id)
	uassert.Equal(t, int(StatusExpired), int(getGame(id).Status))
	uassert.Equal(t, int64(0), reserved)
	uassert.Equal(t, 1, getPlayer(alice).Played)
	uassert.AbortsContains(t, cur, "seule une partie tirée", func() { expireAs(cur, bob, id) })
}

// [C-3] Vider la banque : chaque mise réserve son gain maximal ; impossible de
// promettre plus que ce que la banque possède, même avec beaucoup de joueurs.
func TestSecurityBankNeverOvercommits(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 80*UgnotPerGnot) // couvre exactement 2 mises de 10 GNOT (2 x 40)

	uassert.Equal(t, MaxBet, MaxCoverableBet())
	play(cur, alice, MaxBet, 1, "o1")
	play(cur, bob, MaxBet, 1, "o2")
	uassert.Equal(t, 100*UgnotPerGnot, reserved)
	uassert.Equal(t, int64(0), Available())
	uassert.Equal(t, int64(0), MaxCoverableBet())

	carol := testutils.TestAddress("carol")
	uassert.AbortsWithMessage(t, cur, "gnodice: la banque ne peut pas couvrir ce gain, essaie une mise plus petite", func() {
		playAs(cur, carol, MinBet, Commitment(carol, 1, salt("o3")))
	})
	// Les deux gagnent : la banque paie tout et ne tombe pas sous zéro
	resolveTo(cur, 1, 1)
	resolveTo(cur, 2, 1)
	revealAs(cur, alice, 1, 1, salt("o1"))
	revealAs(cur, bob, 2, 1, salt("o2"))
	uassert.True(t, Bankroll() >= 0)
	uassert.Equal(t, int64(0), reserved)
}

// [H-5] Le propriétaire ne peut pas retirer l'argent promis aux parties en cours.
func TestSecurityWithdrawRespectsReserve(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	play(cur, alice, MaxBet, 1, "wr") // réserve 50, banque 110

	uassert.Equal(t, 60*UgnotPerGnot, Available())
	uassert.AbortsContains(t, cur, "montant supérieur au solde disponible", func() { withdrawAs(cur, testOwner, 61*UgnotPerGnot) })
	uassert.NotAborts(t, cur, func() { withdrawAs(cur, testOwner, 60*UgnotPerGnot) })
	uassert.Equal(t, 50*UgnotPerGnot, Bankroll())
}

// [H-6] Droits d'administration : personne d'autre que le propriétaire.
func TestSecurityAdminOnlyOwner(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	msg := "gnodice: action réservée au propriétaire du contrat"
	uassert.AbortsWithMessage(t, cur, msg, func() { setPausedAs(cur, alice, true) })
	uassert.AbortsWithMessage(t, cur, msg, func() { withdrawAs(cur, alice, MinBet) })
	uassert.AbortsWithMessage(t, cur, msg, func() { setCroupierAs(cur, alice, alice) })
	uassert.AbortsWithMessage(t, cur, msg, func() { setBlockedAs(cur, alice, bob, true) })
	uassert.AbortsWithMessage(t, cur, msg, func() { setLimitsAs(cur, alice, 1000*UgnotPerGnot, 0) })
	uassert.AbortsWithMessage(t, cur, msg, func() { transferOwnershipAs(cur, alice, alice) })
	// Le croupier n'a aucun droit d'administration
	uassert.AbortsWithMessage(t, cur, msg, func() { withdrawAs(cur, testCroupier, MinBet) })
	uassert.AbortsWithMessage(t, cur, "gnodice: montant invalide", func() { withdrawAs(cur, testOwner, 0) })
	uassert.AbortsWithMessage(t, cur, "gnodice: montant invalide", func() { withdrawAs(cur, testOwner, -5) })
	uassert.AbortsContains(t, cur, "la limite du jour", func() { setLimitsAs(cur, testOwner, MinBet, 0) })
}

// [M-2] Transfert de propriété en deux temps : une faute de frappe ne fait pas perdre le contrôle.
func TestSecurityTwoStepOwnership(cur realm, t *testing.T) {
	resetState(cur)
	transferOwnershipAs(cur, testOwner, alice)
	uassert.Equal(t, testOwner, Owner(), "rien ne change avant l'acceptation")
	uassert.AbortsWithMessage(t, cur, "gnodice: aucune proposition de transfert pour cette adresse", func() { acceptOwnershipAs(cur, bob) })
	acceptOwnershipAs(cur, alice)
	uassert.Equal(t, alice, Owner())
	uassert.AbortsWithMessage(t, cur, "gnodice: action réservée au propriétaire du contrat", func() { setPausedAs(cur, testOwner, true) })
	uassert.AbortsWithMessage(t, cur, "gnodice: aucune proposition de transfert pour cette adresse", func() { acceptOwnershipAs(cur, alice) })
}

// [M-3] Pause d'urgence et liste noire.
func TestSecurityPauseAndBlocklist(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	id := play(cur, alice, MinBet, 2, "p")

	setPausedAs(cur, testOwner, true)
	uassert.AbortsWithMessage(t, cur, "gnodice: le jeu est en pause", func() { play(cur, bob, MinBet, 2, "p2") })
	uassert.Equal(t, int64(0), MaxCoverableBet())
	// En pause, les parties en cours se terminent quand même
	resolveTo(cur, id, 2)
	uassert.Equal(t, "roll=2;won=true;payout=5000000", revealAs(cur, alice, id, 2, salt("p")))
	setPausedAs(cur, testOwner, false)

	setBlockedAs(cur, testOwner, bob, true)
	uassert.AbortsWithMessage(t, cur, "gnodice: cette adresse n'est pas autorisée à jouer", func() { play(cur, bob, MinBet, 2, "p3") })
	setBlockedAs(cur, testOwner, bob, false)
	uassert.NotAborts(t, cur, func() { play(cur, bob, MinBet, 2, "p4") })
}

// [H-7] Croupier compromis : le coupe-circuit met le jeu en pause au-delà de la limite du jour.
func TestSecurityCircuitBreaker(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 1000*UgnotPerGnot)
	setLimitsAs(cur, testOwner, 100*UgnotPerGnot, 0)

	for i := 0; i < 2; i++ {
		player := testutils.TestAddress("cb" + strconv.Itoa(i))
		id := play(cur, player, MaxBet, 5, "cb"+strconv.Itoa(i))
		resolveTo(cur, id, 5) // le « croupier compromis » fait gagner
		revealAs(cur, player, id, 5, salt("cb"+strconv.Itoa(i)))
	}
	uassert.True(t, paused, "pause automatique après 100 GNOT de gains")
	uassert.AbortsWithMessage(t, cur, "gnodice: le jeu est en pause", func() { play(cur, alice, MinBet, 5, "cb-x") })
}

// [L-1] Croupier changé : l'ancien ne peut plus tirer.
func TestSecurityCroupierRotation(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	id := play(cur, alice, MinBet, 1, "cr")
	newCroupier := testutils.TestAddress("croupier2")
	setCroupierAs(cur, testOwner, newCroupier)
	uassert.AbortsWithMessage(t, cur, "gnodice: seul le croupier peut tirer les dés", func() { resolveAs(cur, testCroupier, id, seed("a")) })
	uassert.NotAborts(t, cur, func() { resolveAs(cur, newCroupier, id, seed("a")) })
	uassert.AbortsWithMessage(t, cur, "gnodice: cette partie n'attend pas de tirage", func() { resolveAs(cur, newCroupier, id, seed("b")) })
	uassert.AbortsWithMessage(t, cur, "gnodice: graine invalide (64 caractères hexadécimaux attendus)", func() { resolveAs(cur, newCroupier, id, "xyz") })
}

// [L-2] Injection dans les lectures et l'affichage : seules des valeurs validées sont écrites.
func TestSecurityReadsAndRender(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	uassert.Equal(t, `{"error":"adresse invalide"}`, GetPlayerJSON(`g1"},{"x":1`))
	uassert.Equal(t, `{"error":"partie introuvable"}`, GetGameJSON(42))
	uassert.Equal(t, "# GNO-DICE\n\nAdresse invalide.\n", Render("player/<script>alert(1)</script>"))
	uassert.Equal(t, "# GNO-DICE\n\nPartie introuvable.\n", Render("game/1;drop"))
	uassert.Equal(t, "# GNO-DICE\n\nPartie introuvable.\n", Render("game/-1"))
}

// =============================================================================
// Lectures (JSON) et affichage
// =============================================================================

func TestReadFunctions(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 100*UgnotPerGnot)
	id := play(cur, alice, 2*UgnotPerGnot, 4, "rd")

	info := GetInfoJSON()
	urequire.True(t, strings.HasPrefix(info, `{"owner":"`+testOwner.String()+`",`))
	uassert.True(t, strings.HasSuffix(info, `"recent":[]}`))
	uassert.True(t, strings.Contains(info, `"reserved":10000000,`))
	uassert.True(t, strings.Contains(info, `"openGames":1,`))

	open := GetOpenGamesJSON(0)
	uassert.True(t, strings.HasPrefix(open, `[{"id":1,"player":"`+alice.String()+`","status":"pending",`))
	uassert.Equal(t, "[]", GetOpenGamesJSON(id))

	player := GetPlayerJSON(alice.String())
	uassert.True(t, strings.Contains(player, `"open":[{"id":1,`))
	uassert.True(t, strings.HasSuffix(player, `"history":[]}`))

	resolveTo(cur, id, 4)
	revealAs(cur, alice, id, 4, salt("rd"))
	game := GetGameJSON(id)
	uassert.True(t, strings.Contains(game, `"status":"won",`))
	uassert.True(t, strings.Contains(game, `"guess":4,"roll":4,`))
	uassert.True(t, strings.Contains(GetPlayerJSON(alice.String()), `"open":[],"history":[{"id":1,`))
	uassert.True(t, strings.Contains(Render(""), "| [1](:game/1) |"))
	uassert.True(t, strings.Contains(Render("game/1"), "Graine du croupier"))
	uassert.True(t, strings.Contains(Render("player/"+alice.String()), "Parties terminées : 1 (1 gagnées)"))
}

func TestFormatHelpers(t *testing.T) {
	uassert.Equal(t, "1", formatGnot(1_000_000))
	uassert.Equal(t, "1.5", formatGnot(1_500_000))
	uassert.Equal(t, "0.000001", formatGnot(1))
	uassert.Equal(t, "-2.25", formatGnot(-2_250_000))
	uassert.Equal(t, "7 min 12 s", formatDuration(432))
	uassert.Equal(t, "45 s", formatDuration(45))
	uassert.Equal(t, "000000000042", gameKey(42))
}

// =============================================================================
// Stress : 1 000 parties de 1 000 joueurs différents, puis vérification de
// toutes les règles de comptabilité (aucun GNOT créé ni perdu).
// =============================================================================

func TestStress1000Games(cur realm, t *testing.T) {
	resetState(cur)
	fundBank(cur, 5_000*UgnotPerGnot)
	setLimitsAs(cur, testOwner, 1_000_000*UgnotPerGnot, 0)
	startBank := Bankroll()
	const n = 1000

	paidOut := int64(0)
	wagered := int64(0)
	rolls := make([]int, DieFaces+1)
	for i := 0; i < n; i++ {
		label := "st" + strconv.Itoa(i)
		player := testutils.TestAddress(label)
		guess := i%DieFaces + 1
		bet := MinBet + int64(i%10)*UgnotPerGnot/2
		id := play(cur, player, bet, guess, label)
		wagered += bet
		// Graine « honnête » : le croupier ne connaît pas le chiffre
		resolveAs(cur, testCroupier, id, seed(label))
		g := getGame(id)
		rolls[g.Roll]++
		before := balanceOf(player)
		revealAs(cur, player, id, guess, salt(label))
		paidOut += balanceOf(player) - before
	}

	uassert.Equal(t, int64(n), totalGames)
	uassert.Equal(t, n, totalWins+totalLosses)
	uassert.Equal(t, int64(0), reserved, "plus rien de réservé")
	uassert.Equal(t, 0, openGames.Size())
	uassert.Equal(t, wagered, totalWagered)
	uassert.Equal(t, paidOut, totalPaid)
	uassert.Equal(t, startBank+wagered-paidOut, Bankroll(), "solde = départ + mises - gains")
	for face := 1; face <= DieFaces; face++ {
		uassert.True(t, rolls[face] > 120 && rolls[face] < 220, "face "+strconv.Itoa(face)+" : "+strconv.Itoa(rolls[face]))
	}
	uassert.True(t, totalWins > 120 && totalWins < 220, "environ 1 victoire sur 6 : "+strconv.Itoa(totalWins))
	t.Logf("1000 parties : %d gagnées, banque %s -> %s GNOT", totalWins, formatGnot(startBank), formatGnot(Bankroll()))
}
