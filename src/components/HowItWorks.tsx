import { useTranslations } from "next-intl";
import { Dices, ExternalLink, EyeOff, Landmark, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { config, contractUrl, GAME } from "@/lib/config";

// Section « Comment ça marche » : explique sans jargon pourquoi le jeu ne peut
// pas être truqué, et donne les liens pour le vérifier soi-même (contrat sur
// Gno.land, code source, audit). Le détail technique est dans
// contract/gnodice/gnodice.gno et SECURITY_AUDIT.md.

// Icône de chaque étape ; titres et textes : messages/*.json (how.step1Title, how.step1Text…).
const STEP_ICONS: LucideIcon[] = [ShieldCheck, EyeOff, Dices, ScanSearch, Landmark];

export function HowItWorks() {
  const t = useTranslations("how");
  const STEPS = STEP_ICONS.map((icon, i) => ({
    icon,
    title: t(`step${i + 1}Title`),
    text: t(`step${i + 1}Text`, { multiplier: GAME.multiplier }),
  }));
  const links = [
    { href: contractUrl, label: t("contract") },
    { href: config.repoUrl, label: t("source") },
    { href: `${config.repoUrl}/blob/main/SECURITY_AUDIT.md`, label: t("audit") },
  ];

  return (
    <section id="comment-ca-marche" aria-labelledby="how-title" className="scroll-mt-24">
      <div className="page-container grid gap-12 py-24 sm:py-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-24">
        {/* Intro et liens de vérification (reste visible pendant qu'on lit les étapes) */}
        <div className="flex flex-col lg:sticky lg:top-28 lg:self-start">
          <h2 id="how-title" className="display-soft text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-0.02em] text-chalk">
            {t("title")}
          </h2>
          <p className="mt-5 max-w-[40ch] text-haze sm:text-lg sm:leading-relaxed">
            {t("intro")}
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-[0.95rem]">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                  {l.label}
                  <ExternalLink aria-hidden className="size-3.5 opacity-70" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Les étapes d'une partie, dans l'ordre */}
        <ol className="flex flex-col border-b border-border">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 border-t border-border py-8 sm:gap-x-7">
              <span className="relative grid size-12 place-items-center rounded-full border border-border bg-lapis-800 text-signal">
                <Icon aria-hidden className="size-5" />
                <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-signal text-[0.7rem] font-semibold text-lapis">
                  {i + 1}
                </span>
              </span>
              <div>
                <h3 className="text-lg font-medium text-chalk sm:text-xl">{title}</h3>
                <p className="mt-2 max-w-[56ch] leading-relaxed text-haze">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
