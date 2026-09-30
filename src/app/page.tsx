import { Sparkles } from "lucide-react";
import { Casino } from "@/components/Casino";

export default function Home() {
  return (
    <main className="page-container">
      <section className="relative py-8 text-center sm:py-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-black/40 px-3.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-primary/90 animate-in fade-in slide-in-from-top-2 duration-700">
          <Sparkles className="size-3.5" /> Casino 100 % on-chain
        </p>
        <h1 className="mt-4 font-display text-[clamp(2rem,6.5vw,3.75rem)] font-extrabold leading-[1.08] tracking-wide animate-in fade-in slide-in-from-bottom-3 duration-700">
          Devine le dé, <span className="gold-text-animated">gagne ×5</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground animate-in fade-in duration-1000 sm:text-lg">
          Choisis un chiffre, mise entre 1 et 10 GNOT et lance le dé sur la blockchain Gno.land. Un lancer toutes les 10 minutes.
        </p>
        {/* Ornement art déco */}
        <div aria-hidden className="mx-auto mt-6 flex max-w-sm items-center gap-3">
          <span className="gold-rule" />
          <span className="size-2 shrink-0 rotate-45 border border-primary/70 bg-primary/20" />
          <span className="gold-rule" />
        </div>
      </section>
      <Casino />
    </main>
  );
}
