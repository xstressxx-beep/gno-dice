package gnodice

import (
	"strconv"
	"strings"
)

// Render affiche une page lisible sur gnoweb (le site officiel de gno.land).
//   - chemin ""               : règles, banque et 10 dernières parties
//   - chemin "player/<g1...>" : statistiques et historique d'un joueur
//
// Le chemin est choisi par le visiteur : on ne l'affiche jamais tel quel, on
// n'utilise qu'une adresse validée.
func Render(path string) string {
	if strings.HasPrefix(path, "player/") {
		player := address(strings.TrimPrefix(path, "player/"))
		if !player.IsValid() {
			return "# GNO-DICE\n\nAdresse invalide.\n"
		}
		return renderPlayer(player)
	}
	return renderHome()
}

func renderHome() string {
	var b strings.Builder
	b.WriteString("# 🎲 GNO-DICE\n\n")
	b.WriteString("Choisis un chiffre de 1 à 6, mise entre 1 et 10 GNOT. ")
	b.WriteString("Si le dé tombe sur ton chiffre, tu gagnes **5 fois ta mise**. ")
	b.WriteString("Un lancer toutes les 10 minutes.\n\n")

	if paused {
		b.WriteString("> ⏸️ Le jeu est actuellement en pause.\n\n")
	}

	b.WriteString("## Banque\n\n")
	b.WriteString("- Solde : " + formatGnot(Bankroll()) + " GNOT\n")
	b.WriteString("- Mise maximale acceptée en ce moment : " + formatGnot(MaxCoverableBet()) + " GNOT\n")
	b.WriteString("- Parties jouées : " + strconv.Itoa(totalGames) + " (" + strconv.Itoa(totalWins) + " gagnées)\n")
	b.WriteString("- Total misé : " + formatGnot(totalWagered) + " GNOT — total payé : " + formatGnot(totalPaid) + " GNOT\n\n")

	b.WriteString("## Dernières parties\n\n")
	writeGamesTable(&b, recent, true)
	return b.String()
}

func renderPlayer(player address) string {
	var b strings.Builder
	b.WriteString("# 🎲 GNO-DICE — joueur\n\n")
	b.WriteString("`" + player.String() + "`\n\n")

	p := getPlayer(player)
	if p == nil {
		b.WriteString("Aucune partie jouée pour l'instant.\n")
		return b.String()
	}
	b.WriteString("- Parties : " + strconv.Itoa(p.Played) + " (" + strconv.Itoa(p.Wins) + " gagnées)\n")
	b.WriteString("- Total misé : " + formatGnot(p.Wagered) + " GNOT — total gagné : " + formatGnot(p.Paid) + " GNOT\n\n")
	b.WriteString("## 10 dernières parties\n\n")
	writeGamesTable(&b, p.History, false)
	return b.String()
}

func writeGamesTable(b *strings.Builder, games []Game, withPlayer bool) {
	if len(games) == 0 {
		b.WriteString("Aucune partie pour l'instant.\n")
		return
	}
	if withPlayer {
		b.WriteString("| # | Bloc | Joueur | Mise | Chiffre | Dé | Résultat |\n")
		b.WriteString("|---|---|---|---|---|---|---|\n")
	} else {
		b.WriteString("| # | Bloc | Mise | Chiffre | Dé | Résultat |\n")
		b.WriteString("|---|---|---|---|---|---|\n")
	}
	for i := len(games) - 1; i >= 0; i-- {
		g := games[i]
		b.WriteString("| " + strconv.Itoa(g.ID) + " | " + strconv.FormatInt(g.Height, 10) + " | ")
		if withPlayer {
			b.WriteString(shortAddress(g.Player) + " | ")
		}
		b.WriteString(formatGnot(g.Bet) + " GNOT | " + strconv.Itoa(g.Guess) + " | " + strconv.Itoa(g.Roll) + " | ")
		if g.Won {
			b.WriteString("✅ +" + formatGnot(g.Payout) + " GNOT |\n")
		} else {
			b.WriteString("❌ perdu |\n")
		}
	}
}

// shortAddress raccourcit une adresse : g1abcd...wxyz
func shortAddress(a address) string {
	s := a.String()
	if len(s) <= 12 {
		return s
	}
	return s[:6] + "..." + s[len(s)-4:]
}

// formatGnot convertit des ugnot en GNOT lisibles : 1500000 -> "1.5"
func formatGnot(ugnot int64) string {
	sign := ""
	if ugnot < 0 {
		sign = "-"
		ugnot = -ugnot
	}
	whole := ugnot / UgnotPerGnot
	frac := ugnot % UgnotPerGnot
	if frac == 0 {
		return sign + strconv.FormatInt(whole, 10)
	}
	fracStr := strconv.FormatInt(frac+UgnotPerGnot, 10)[1:] // complète avec des zéros : 500000 -> "500000"
	fracStr = strings.TrimRight(fracStr, "0")
	return sign + strconv.FormatInt(whole, 10) + "." + fracStr
}
