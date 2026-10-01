"use client";

// « Partie en cours » : les parties du joueur qui ne sont pas encore terminées.
// Reprise automatique (onglet fermé, réseau coupé…) :
// - en attente de tirage : on relance le croupier ; après 30 min, le joueur
//   peut récupérer sa mise (Refund) ;
// - dé tiré : on dévoile le chiffre gardé dans ce navigateur (relayé par le
//   croupier) ; en secours, le joueur signe lui-même la révélation.

import { useErrorText } from "@/i18n/errors";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { sendTransaction } from "@/lib/adena";
import { GAS } from "@/lib/config";
import { requestResolve, requestReveal } from "@/lib/croupierClient";
import { formatCountdown, formatGnot } from "@/lib/format";
import { estimateFee, type Game } from "@/lib/gno";
import { refundMessage, revealMessage } from "@/lib/gnodice";
import { findSecret, forgetSecret } from "@/lib/secrets";
import { useNow } from "@/hooks/useNow";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useWallet } from "./WalletProvider";

type Props = {
  games: Game[];
  onChange: () => void;
  /** Met en avant l'action manuelle (le croupier n'a pas pu relayer). */
  highlightManual?: boolean;
};

export function OpenGames({ games, onChange, highlightManual }: Props) {
  const t = useTranslations("open");
  return (
    <section aria-label={t("section")} className={`flex flex-col gap-3 rounded-2xl border p-4 ${highlightManual ? "border-ruby/60" : "border-border"}`}>
      <h3 className="text-[0.95rem] font-medium text-chalk">{t("heading")}</h3>
      {games.map((g) => (
        <OpenGameRow key={g.id} game={g} onChange={onChange} />
      ))}
    </section>
  );
}

function OpenGameRow({ game, onChange }: { game: Game; onChange: () => void }) {
  const t = useTranslations("open");
  const locale = useLocale();
  const errorText = useErrorText();
  const wallet = useWallet();
  // Heure actuelle, relue chaque seconde (compte à rebours)
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);
  const secret = game.status === "rolled" ? findSecret(game.commitment) : null;
  const refundable = game.status === "pending" && now > 0 && now >= game.resolveDeadline;

  // Reprise automatique, une seule fois par partie
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    if (game.status === "pending" && Date.now() / 1000 < game.resolveDeadline) {
      requestResolve(game.id).then(onChange, () => undefined);
    } else if (game.status === "rolled") {
      const s = findSecret(game.commitment);
      if (s) {
        requestReveal(game.id, s.guess, s.salt).then((g) => {
          if (g.status === "won" || g.status === "lost") forgetSecret(game.commitment);
          onChange();
        }, () => undefined);
      }
    }
  }, [game, onChange]);

  async function signYourself(kind: "refund" | "reveal") {
    if (!wallet.address || busy) return;
    setBusy(true);
    setError(null);
    try {
      const gas = kind === "refund" ? GAS.refund : GAS.reveal;
      const fee = await estimateFee(gas);
      const msg = kind === "refund" ? refundMessage(wallet.address, game.id) : revealMessage(wallet.address, game.id, secret!.guess, secret!.salt);
      await sendTransaction([msg], gas, fee);
      if (kind === "reveal") forgetSecret(game.commitment);
      onChange();
      wallet.refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  let text: string;
  let actionLabel: string | null = null;
  let action: (() => void) | null = null;
  if (game.status === "pending" && !refundable) {
    text = t("pending", { amount: formatGnot(game.bet, 2, locale), time: formatCountdown(Math.max(0, game.resolveDeadline - now)) });
  } else if (refundable) {
    text = t("late", { amount: formatGnot(game.bet, 2, locale) });
    actionLabel = t("refund");
    action = () => signYourself("refund");
  } else if (secret) {
    const won = secret.guess === game.roll;
    text = won
      ? t("won", { roll: game.roll, amount: formatGnot(game.bet * 5, 2, locale) })
      : t("lost", { roll: game.roll, guess: secret.guess });
    actionLabel = won ? t("claim") : t("finish");
    action = () => signYourself("reveal");
  } else {
    text = t("noSecret", { roll: game.roll });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[46ch] text-sm text-haze">
          <span className="text-chalk">{t("game", { id: game.id })}</span> {text}
        </p>
        {action && actionLabel && (
          <Button size="sm" onClick={action} disabled={busy || !wallet.address}>
            {busy ? t("signing") : actionLabel}
          </Button>
        )}
      </div>
      {error && <Alert variant="destructive">{errorText(error)}</Alert>}
    </div>
  );
}
