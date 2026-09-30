package gnodice

import (
	"strconv"
	"strings"
	"time"
)

// Ces fonctions ne modifient rien : le site les appelle gratuitement (sans
// transaction ni signature) pour lire l'état du jeu. Elles renvoient du JSON.

// GetInfoJSON renvoie l'état global du jeu.
//
// Exemple :
//
//	{"owner":"g1...","realm":"g1...","paused":false,"bankroll":150000000,
//	 "maxCoverableBet":10000000,"minBet":1000000,"maxBet":10000000,
//	 "multiplier":5,"cooldown":600,"historySize":10,"totalGames":42,
//	 "totalWins":7,"totalWagered":...,"totalPaid":...,"now":1790000000,
//	 "recent":[...]}
func GetInfoJSON() string {
	var b strings.Builder
	b.WriteString("{")
	writeStringField(&b, "owner", owner.String())
	b.WriteString(",")
	writeStringField(&b, "realm", realmAddr.String())
	b.WriteString(",")
	writeBoolField(&b, "paused", paused)
	b.WriteString(",")
	writeIntField(&b, "bankroll", Bankroll())
	b.WriteString(",")
	writeIntField(&b, "maxCoverableBet", MaxCoverableBet())
	b.WriteString(",")
	writeIntField(&b, "minBet", MinBet)
	b.WriteString(",")
	writeIntField(&b, "maxBet", MaxBet)
	b.WriteString(",")
	writeIntField(&b, "multiplier", PayoutMultiplier)
	b.WriteString(",")
	writeIntField(&b, "cooldown", CooldownSeconds)
	b.WriteString(",")
	writeIntField(&b, "historySize", HistorySize)
	b.WriteString(",")
	writeIntField(&b, "totalGames", int64(totalGames))
	b.WriteString(",")
	writeIntField(&b, "totalWins", int64(totalWins))
	b.WriteString(",")
	writeIntField(&b, "totalWagered", totalWagered)
	b.WriteString(",")
	writeIntField(&b, "totalPaid", totalPaid)
	b.WriteString(",")
	writeIntField(&b, "totalFunded", totalFunded)
	b.WriteString(",")
	writeIntField(&b, "now", time.Now().Unix())
	b.WriteString(`,"recent":`)
	writeGamesNewestFirst(&b, recent)
	b.WriteString("}")
	return b.String()
}

// GetPlayerJSON renvoie les statistiques d'un joueur, son temps d'attente
// avant de pouvoir rejouer et ses 10 dernières parties (la plus récente en
// premier).
//
// Exemple :
//
//	{"address":"g1...","played":3,"wins":1,"wagered":6000000,"paid":10000000,
//	 "lastPlay":1790000000,"nextPlayAt":1790000600,"cooldownRemaining":120,
//	 "now":1790000480,"history":[{"id":3,...}]}
func GetPlayerJSON(addr string) string {
	player := address(addr)
	if !player.IsValid() {
		return `{"error":"adresse invalide"}`
	}

	p := getPlayer(player)
	now := time.Now().Unix()

	var b strings.Builder
	b.WriteString("{")
	writeStringField(&b, "address", player.String())
	b.WriteString(",")
	if p == nil {
		p = &playerData{}
	}
	writeIntField(&b, "played", int64(p.Played))
	b.WriteString(",")
	writeIntField(&b, "wins", int64(p.Wins))
	b.WriteString(",")
	writeIntField(&b, "wagered", p.Wagered)
	b.WriteString(",")
	writeIntField(&b, "paid", p.Paid)
	b.WriteString(",")
	writeIntField(&b, "lastPlay", p.LastPlay)
	b.WriteString(",")
	nextPlayAt := int64(0)
	if p.Played > 0 {
		nextPlayAt = p.LastPlay + CooldownSeconds
	}
	writeIntField(&b, "nextPlayAt", nextPlayAt)
	b.WriteString(",")
	writeIntField(&b, "cooldownRemaining", cooldownRemaining(p, now))
	b.WriteString(",")
	writeIntField(&b, "now", now)
	b.WriteString(`,"history":`)
	writeGamesNewestFirst(&b, p.History)
	b.WriteString("}")
	return b.String()
}

// --- petits outils pour écrire du JSON ---
// Les seules chaînes écrites sont des adresses (lettres et chiffres), il n'y
// a donc aucun caractère spécial à échapper.

func writeGamesNewestFirst(b *strings.Builder, games []Game) {
	b.WriteString("[")
	for i := len(games) - 1; i >= 0; i-- {
		if i != len(games)-1 {
			b.WriteString(",")
		}
		writeGame(b, games[i])
	}
	b.WriteString("]")
}

func writeGame(b *strings.Builder, g Game) {
	b.WriteString("{")
	writeIntField(b, "id", int64(g.ID))
	b.WriteString(",")
	writeStringField(b, "player", g.Player.String())
	b.WriteString(",")
	writeIntField(b, "guess", int64(g.Guess))
	b.WriteString(",")
	writeIntField(b, "roll", int64(g.Roll))
	b.WriteString(",")
	writeIntField(b, "bet", g.Bet)
	b.WriteString(",")
	writeIntField(b, "payout", g.Payout)
	b.WriteString(",")
	writeBoolField(b, "won", g.Won)
	b.WriteString(",")
	writeIntField(b, "time", g.Time)
	b.WriteString(",")
	writeIntField(b, "height", g.Height)
	b.WriteString("}")
}

func writeStringField(b *strings.Builder, key, value string) {
	b.WriteString(`"` + key + `":"` + value + `"`)
}

func writeIntField(b *strings.Builder, key string, value int64) {
	b.WriteString(`"` + key + `":` + strconv.FormatInt(value, 10))
}

func writeBoolField(b *strings.Builder, key string, value bool) {
	b.WriteString(`"` + key + `":` + strconv.FormatBool(value))
}
