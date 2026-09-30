// Package gnodice est un jeu de dés décentralisé sur gno.land.
//
// Règles du jeu :
//   - le joueur choisit un chiffre entre 1 et 6 ;
//   - il mise entre 1 et 10 GNOT, envoyés avec la transaction ;
//   - si le dé tombe sur son chiffre, il reçoit 5 fois sa mise ;
//   - chaque joueur ne peut lancer le dé qu'une fois toutes les 10 minutes.
//
// Le contrat garde, pour chaque joueur, ses 10 dernières parties : le site les
// lit avec GetPlayerJSON pour afficher l'historique.
package gnodice

import (
	"chain"
	"chain/banker"
	"chain/runtime"
	"chain/runtime/unsafe"
	"crypto/sha256"
	"encoding/binary"
	"math/rand"
	"strconv"
	"time"

	"gno.land/p/nt/avl/v0"
)

// Paramètres du jeu. 1 GNOT = 1 000 000 ugnot (la plus petite unité).
const (
	Denom            = "ugnot"
	UgnotPerGnot     = int64(1_000_000)
	MinBet           = 1 * UgnotPerGnot  // mise minimale : 1 GNOT
	MaxBet           = 10 * UgnotPerGnot // mise maximale : 10 GNOT
	PayoutMultiplier = int64(5)          // gain = 5 x la mise
	CooldownSeconds  = int64(10 * 60)    // 10 minutes entre deux lancers
	HistorySize      = 10                // nombre de parties gardées par joueur
	DieFaces         = 6
)

// Game décrit une partie jouée.
type Game struct {
	ID     int     // numéro de la partie (1, 2, 3...)
	Player address // adresse du joueur
	Guess  int     // chiffre choisi par le joueur
	Roll   int     // résultat du dé
	Bet    int64   // mise en ugnot
	Payout int64   // somme versée au joueur en ugnot (0 si perdu)
	Won    bool    // true si le joueur a gagné
	Time   int64   // date du bloc (secondes Unix)
	Height int64   // numéro du bloc
}

// playerData regroupe les informations d'un joueur.
type playerData struct {
	LastPlay int64  // date du dernier lancer (secondes Unix)
	Played   int    // nombre total de parties
	Wins     int    // nombre de victoires
	Wagered  int64  // total misé en ugnot
	Paid     int64  // total gagné en ugnot
	History  []Game // les HistorySize dernières parties, de la plus ancienne à la plus récente
}

var (
	owner     address // propriétaire : peut retirer des fonds et mettre le jeu en pause
	realmAddr address // adresse du contrat (c'est aussi l'adresse de la "banque")
	paused    bool

	players = avl.NewTree() // adresse du joueur -> *playerData
	recent  []Game          // les dernières parties, tous joueurs confondus

	totalGames   int
	totalWins    int
	totalWagered int64
	totalPaid    int64
	totalFunded  int64

	// entropy est mélangée à chaque lancer pour que chaque résultat dépende
	// aussi de toutes les parties précédentes.
	entropy [32]byte
)

// init s'exécute une seule fois, au déploiement du contrat.
// Celui qui déploie devient le propriétaire.
func init(cur realm) {
	owner = cur.Previous().Address()
	realmAddr = cur.Address()
	entropy = sha256.Sum256([]byte(cur.PkgPath() + "|" + strconv.FormatInt(time.Now().UnixNano(), 10)))
}

// Play lance le dé. Le joueur doit envoyer sa mise (1 à 10 GNOT) avec la
// transaction. guess est le chiffre choisi (1 à 6).
// Renvoie un résumé lisible, par exemple "roll=4;won=false;payout=0".
func Play(cur realm, guess int) string {
	caller := cur.Previous()

	// Sécurité : la mise est lue dans « l'enveloppe » de la transaction
	// (OriginSend). Ce n'est fiable que si le joueur appelle Play directement
	// depuis son wallet. IsUserCall refuse les scripts et les autres contrats,
	// qui pourraient intercepter les GNOT avant de nous appeler.
	if !caller.IsUserCall() {
		panic("gnodice: Play doit être appelé directement depuis un wallet")
	}
	if paused {
		panic("gnodice: le jeu est en pause")
	}
	if guess < 1 || guess > DieFaces {
		panic("gnodice: le chiffre doit être entre 1 et 6")
	}

	bet := receivedBet()
	player := caller.Address()
	now := time.Now()

	// Une seule partie toutes les 10 minutes par joueur.
	p := getPlayer(player)
	if wait := cooldownRemaining(p, now.Unix()); wait > 0 {
		panic("gnodice: attends encore " + formatDuration(wait) + " avant de rejouer")
	}

	// La banque (qui contient déjà la mise qu'on vient de recevoir) doit
	// pouvoir payer le gain maximal, sinon on refuse la partie et la
	// transaction est annulée : le joueur récupère sa mise.
	payout := bet * PayoutMultiplier
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	if bk.GetCoin(realmAddr, Denom) < payout {
		panic("gnodice: la banque ne peut pas couvrir ce gain, essaie une mise plus petite")
	}

	// IMPORTANT (sécurité) : la branche « perdu » ne doit jamais coûter plus
	// de gas ni de stockage que la branche « gagné ». Sinon un joueur pourrait
	// fixer une limite de gas (ou de dépôt) juste suffisante pour gagner, et
	// toutes ses parties perdues échoueraient... donc seraient remboursées.
	// Aujourd'hui c'est le cas : gagner ajoute un paiement et des compteurs.
	roll := rollDie(player, now.UnixNano())
	won := roll == guess
	if won {
		bk.SendCoins(realmAddr, player, chain.NewCoins(chain.NewCoin(Denom, payout)))
	} else {
		payout = 0
	}

	// On enregistre la partie.
	if p == nil {
		p = &playerData{}
		players.Set(player.String(), p)
	}
	totalGames++
	game := Game{
		ID:     totalGames,
		Player: player,
		Guess:  guess,
		Roll:   roll,
		Bet:    bet,
		Payout: payout,
		Won:    won,
		Time:   now.Unix(),
		Height: runtime.ChainHeight(),
	}

	p.LastPlay = now.Unix()
	p.Played++
	p.Wagered += bet
	p.Paid += payout
	p.History = pushGame(p.History, game)
	recent = pushGame(recent, game)

	totalWagered += bet
	totalPaid += payout
	if won {
		p.Wins++
		totalWins++
	}

	chain.Emit(
		"DiceRolled",
		"id", strconv.Itoa(game.ID),
		"player", player.String(),
		"guess", strconv.Itoa(guess),
		"roll", strconv.Itoa(roll),
		"bet", strconv.FormatInt(bet, 10),
		"payout", strconv.FormatInt(payout, 10),
		"won", strconv.FormatBool(won),
	)

	return "roll=" + strconv.Itoa(roll) + ";won=" + strconv.FormatBool(won) + ";payout=" + strconv.FormatInt(payout, 10)
}

// Fund permet d'alimenter la banque du jeu (celle qui paie les gains).
// N'importe qui peut l'appeler en envoyant des GNOT avec la transaction.
func Fund(cur realm) {
	if !cur.Previous().IsUserCall() {
		panic("gnodice: Fund doit être appelé directement depuis un wallet")
	}
	amount := unsafe.OriginSend().AmountOf(Denom)
	if amount <= 0 {
		panic("gnodice: envoie des GNOT avec la transaction pour alimenter la banque")
	}
	totalFunded += amount
	chain.Emit("BankFunded", "from", cur.Previous().Address().String(), "amount", strconv.FormatInt(amount, 10))
}

// Withdraw permet au propriétaire de retirer des GNOT de la banque.
// amount est en ugnot (1 GNOT = 1 000 000 ugnot).
func Withdraw(cur realm, amount int64) {
	assertOwner(cur)
	if amount <= 0 {
		panic("gnodice: montant invalide")
	}
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	if bk.GetCoin(realmAddr, Denom) < amount {
		panic("gnodice: la banque ne contient pas assez de GNOT")
	}
	bk.SendCoins(realmAddr, owner, chain.NewCoins(chain.NewCoin(Denom, amount)))
	chain.Emit("BankWithdrawn", "to", owner.String(), "amount", strconv.FormatInt(amount, 10))
}

// SetPaused met le jeu en pause (true) ou le relance (false). Propriétaire uniquement.
func SetPaused(cur realm, value bool) {
	assertOwner(cur)
	paused = value
	chain.Emit("PauseChanged", "paused", strconv.FormatBool(value))
}

// TransferOwnership donne le contrôle du contrat à une autre adresse.
// Propriétaire uniquement. Attention : c'est irréversible.
func TransferOwnership(cur realm, newOwner address) {
	assertOwner(cur)
	if !newOwner.IsValid() {
		panic("gnodice: adresse invalide")
	}
	previous := owner
	owner = newOwner
	chain.Emit("OwnershipTransferred", "from", previous.String(), "to", newOwner.String())
}

// Owner renvoie l'adresse du propriétaire.
func Owner() address {
	return owner
}

// Bankroll renvoie le solde de la banque en ugnot.
func Bankroll() int64 {
	return banker.NewReadonlyBanker().GetCoin(realmAddr, Denom)
}

// MaxCoverableBet renvoie la plus grosse mise (en ugnot) que la banque peut
// accepter en ce moment. Si le joueur mise b, la banque contient solde + b et
// doit pouvoir payer 5 x b, donc b <= solde / 4.
func MaxCoverableBet() int64 {
	max := Bankroll() / (PayoutMultiplier - 1)
	if max > MaxBet {
		return MaxBet
	}
	return max
}

// --- fonctions internes ---

func assertOwner(cur realm) {
	if cur.Previous().Address() != owner {
		panic("gnodice: action réservée au propriétaire du contrat")
	}
}

// receivedBet vérifie la mise envoyée avec la transaction et renvoie son montant.
func receivedBet() int64 {
	sent := unsafe.OriginSend()
	if len(sent) != 1 || sent[0].Denom != Denom {
		panic("gnodice: envoie ta mise en GNOT uniquement")
	}
	amount := sent[0].Amount
	if amount < MinBet || amount > MaxBet {
		panic("gnodice: la mise doit être entre 1 et 10 GNOT")
	}
	return amount
}

func getPlayer(addr address) *playerData {
	v := players.Get(addr.String())
	if v == nil {
		return nil
	}
	return v.(*playerData)
}

// cooldownRemaining renvoie le nombre de secondes à attendre avant de
// pouvoir rejouer (0 si le joueur peut jouer maintenant).
func cooldownRemaining(p *playerData, now int64) int64 {
	if p == nil || p.Played == 0 {
		return 0
	}
	wait := p.LastPlay + CooldownSeconds - now
	if wait < 0 {
		return 0
	}
	return wait
}

// rollDie tire un nombre entre 1 et 6.
//
// ATTENTION : une blockchain est déterministe, il n'existe pas de vrai hasard.
// On mélange (hash SHA-256) plusieurs valeurs impossibles à connaître au moment
// où le joueur signe sa transaction : l'heure exacte du bloc (en nanosecondes),
// sa hauteur, le numéro de la partie et l'entropie accumulée par toutes les
// parties précédentes, en plus de l'adresse du joueur.
// C'est suffisant pour un jeu sur testnet, mais un validateur malveillant
// pourrait influencer le résultat : à ne pas utiliser pour de gros montants.
//
// Seul un appel direct depuis un wallet est accepté (voir Play) : un autre
// contrat ne peut donc pas calculer le résultat à l'avance et annuler la
// transaction s'il perd.
func rollDie(player address, nowNano int64) int {
	buf := make([]byte, 0, 32+64+24)
	buf = append(buf, entropy[:]...)
	buf = append(buf, []byte(player.String())...)
	buf = appendInt64(buf, nowNano)
	buf = appendInt64(buf, runtime.ChainHeight())
	buf = appendInt64(buf, int64(totalGames))
	entropy = sha256.Sum256(buf)

	seed1 := binary.BigEndian.Uint64(entropy[0:8])
	seed2 := binary.BigEndian.Uint64(entropy[8:16])
	r := rand.New(rand.NewPCG(seed1, seed2))
	return r.IntN(DieFaces) + 1
}

func appendInt64(buf []byte, v int64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, uint64(v))
	return append(buf, b...)
}

// pushGame ajoute une partie à la liste en ne gardant que les HistorySize
// plus récentes (la plus ancienne est supprimée).
func pushGame(list []Game, g Game) []Game {
	if len(list) < HistorySize {
		return append(list, g)
	}
	out := make([]Game, 0, HistorySize)
	out = append(out, list[len(list)-HistorySize+1:]...)
	return append(out, g)
}

// formatDuration transforme un nombre de secondes en texte, ex. "7 min 12 s".
func formatDuration(seconds int64) string {
	if seconds < 60 {
		return strconv.FormatInt(seconds, 10) + " s"
	}
	return strconv.FormatInt(seconds/60, 10) + " min " + strconv.FormatInt(seconds%60, 10) + " s"
}
