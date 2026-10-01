"use client";

// « Comment ça marche » : trois étapes qui apparaissent l'une après l'autre au
// défilement, puis un bandeau de confiance (contrat public, aucun intermédiaire).

import { motion } from "framer-motion";
import { Coins, Dices, Hand, ScrollText } from "lucide-react";
import { config, GAME } from "@/lib/config";
import { EASE_OUT_EXPO, Reveal } from "./Reveal";

const STEPS = [
  {
    icon: Hand,
    title: "Choisis ton chiffre",
    text: "Un chiffre de 1 à 6. Une seule chance sur six, mais c'est toi qui décides.",
  },
  {
    icon: Coins,
    title: "Fixe ta mise",
    text: `Entre ${GAME.minBetGnot} et ${GAME.maxBetGnot} GNOT. Le gain possible s'affiche en direct.`,
  },
  {
    icon: Dices,
    title: "Lance le dé",
    text: `Tu signes dans Adena, le contrat tire le dé. Bon chiffre : ×${GAME.multiplier} ta mise, versés aussitôt.`,
  },
];

export function HowItWorks() {
  const contractUrl = `${config.gnowebUrl}/${config.realmPath.replace(/^gno\.land\//, "")}`;

  return (
    <section id="regles" className="scroll-mt-24 py-20 sm:py-28" aria-labelledby="regles-title">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-primary">Comment ça marche</p>
        <h2 id="regles-title" className="mt-4 text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-[#f7f1e3]">
          Trois gestes. <span className="text-[#8f887a]">Zéro intermédiaire.</span>
        </h2>
      </Reveal>

      <ol className="mt-14 grid gap-4 sm:mt-16 md:grid-cols-3 md:gap-5">
        {STEPS.map((step, i) => (
          <motion.li
            key={step.title}
            data-spotlight
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: i * 0.12 }}
            whileHover={{ y: -4 }}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 backdrop-blur-md transition-colors duration-500 hover:border-primary/30 sm:p-7"
          >
            <span aria-hidden className="absolute right-5 top-3 font-display text-7xl font-extrabold text-white/[0.03] transition-colors duration-500 group-hover:text-primary/10">
              {i + 1}
            </span>
            <span className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
              <step.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight text-[#f7f1e3]">{step.title}</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-[#a39c8c]">{step.text}</p>
          </motion.li>
        ))}
      </ol>

      <Reveal delay={0.1} className="mt-5">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/[0.07] bg-gradient-to-r from-primary/[0.08] via-transparent to-transparent p-6 sm:flex-row sm:items-center sm:p-7">
          <div className="flex items-start gap-4">
            <ScrollText className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="max-w-xl text-[0.95rem] leading-relaxed text-[#a39c8c]">
              <strong className="font-semibold text-[#f7f1e3]">Code public, règles gravées dans le contrat.</strong> Mises, tirages et gains sont
              enregistrés sur Gno.land : n&apos;importe qui peut les vérifier.
            </p>
          </div>
          <span data-magnetic="0.2" className="inline-block shrink-0">
            <a
              href={contractUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-full border border-primary/30 px-5 text-sm font-medium text-gold-100 no-underline transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-gold-100 hover:no-underline"
            >
              Voir le contrat
            </a>
          </span>
        </div>
      </Reveal>
    </section>
  );
}
