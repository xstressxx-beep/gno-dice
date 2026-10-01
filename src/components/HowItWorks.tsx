import type { ReactNode } from "react";
import { Dices, ExternalLink, EyeOff, Landmark, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { config, contractUrl, GAME } from "@/lib/config";

// Section « Comment ça marche » : explique sans jargon pourquoi le jeu ne peut
// pas être truqué, et donne les liens pour le vérifier soi-même (contrat sur
// Gno.land, code source, audit). Le détail technique est dans
// contract/gnodice/gnodice.gno et SECURITY_AUDIT.md.

type Step = { icon: LucideIcon; title: string; text: ReactNode };

const STEPS: Step[] = [
  {
    icon: ShieldCheck,
    title: "Ton gain est réservé avant le lancer",
    text: (
      <>
        Dès que tu mises, la banque met de côté {GAME.multiplier} fois ta mise. Si elle ne peut pas, la mise est refusée : aucune partie ne
        promet plus que ce que la banque possède.
      </>
    ),
  },
  {
    icon: EyeOff,
    title: "Ton chiffre reste sous scellé",
    text: "Ton chiffre part de ton navigateur dans une enveloppe scellée. Personne ne peut l’ouvrir avant le lancer, ni le site, ni le croupier.",
  },
  {
    icon: Dices,
    title: "Le dé est tiré à l’aveugle",
    text: "Le croupier, un petit robot du site, fournit un tirage au hasard sans connaître ton chiffre. La face du dé se calcule à partir de ce tirage et de ton enveloppe, puis le tirage est publié.",
  },
  {
    icon: ScanSearch,
    title: "Le résultat est vérifié deux fois",
    text: "Ton navigateur refait le calcul du dé à partir du tirage publié et te prévient si quelque chose ne colle pas. À l’ouverture de l’enveloppe, le contrat vérifie que c’est bien ton chiffre avant de payer. Si le dé n’est jamais tiré, tu récupères ta mise au bout de 30 minutes.",
  },
  {
    icon: Landmark,
    title: "Tout est public",
    text: "La banque, les mises, les tirages et les paiements sont écrits dans le contrat sur Gno.land, lisible par tous et à tout moment. Le code du jeu et du site est ouvert : chacun peut le relire.",
  },
];

export function HowItWorks() {
  const links = [
    { href: contractUrl, label: "Voir le contrat sur Gno.land" },
    { href: config.repoUrl, label: "Lire le code source" },
    { href: `${config.repoUrl}/blob/main/SECURITY_AUDIT.md`, label: "Lire l’audit de sécurité" },
  ];

  return (
    <section id="comment-ca-marche" aria-labelledby="how-title" className="scroll-mt-24">
      <div className="page-container grid gap-12 py-24 sm:py-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-24">
        {/* Intro et liens de vérification (reste visible pendant qu'on lit les étapes) */}
        <div className="flex flex-col lg:sticky lg:top-28 lg:self-start">
          <h2 id="how-title" className="display-soft text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-0.02em] text-chalk">
            Comment ça marche
          </h2>
          <p className="mt-5 max-w-[40ch] text-haze sm:text-lg sm:leading-relaxed">
            Pas besoin de nous croire sur parole. Chaque étape d’une partie laisse une trace publique que tu peux vérifier toi-même.
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
