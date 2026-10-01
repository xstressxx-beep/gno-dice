import { Casino } from "@/components/Casino";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Reveal } from "@/components/Reveal";

export default function Home() {
  return (
    <main>
      <Hero />

      {/* La table de jeu */}
      <section id="table" className="page-container scroll-mt-20 sm:scroll-mt-24" aria-labelledby="table-heading">
        <Reveal className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-primary">La table</p>
          <h2 id="table-heading" className="mt-4 text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-[#f7f1e3]">
            À toi de jouer.
          </h2>
        </Reveal>
        <Casino />
      </section>

      <div className="page-container">
        <HowItWorks />
      </div>
    </main>
  );
}
