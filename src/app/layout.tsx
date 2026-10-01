import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import { CustomCursor } from "@/components/CustomCursor";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { INTRO_KEY, Preloader } from "@/components/Preloader";
import { SmoothScroll } from "@/components/SmoothScroll";
import { MOTION_SCRIPT } from "@/lib/motion";
import "./globals.css";

// Polices :
// - Fraunces : serif variable aux formes douces et « bancales » (axes SOFT et WONK),
//   comme les enseignes de casino peintes à la main ; sa graisse change au défilement
// - Instrument Sans : sans-serif nette et étroite pour l'interface et les nombres
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], style: ["normal", "italic"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "gnodice — six faces, une seule est la tienne",
  description:
    "Choisis un chiffre de 1 à 6, mise entre 1 et 10 GNOT et gagne 5 fois ta mise si le dé tombe sur ton chiffre. Un lancer toutes les 10 minutes, sur Gno.land.",
};

export const viewport: Viewport = {
  themeColor: "#070C2B",
};

// Exécuté avant l'affichage : si l'intro a déjà été vue pendant cette visite,
// on la masque tout de suite (sinon elle clignoterait une fraction de seconde).
const introScript = `try{if(sessionStorage.getItem("${INTRO_KEY}"))document.documentElement.classList.add("intro-seen")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // suppressHydrationWarning : la classe « intro-seen » est ajoutée par le script ci-dessous
    <html lang="fr" className={`dark ${fraunces.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT + introScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Preloader />
        {/* Grain du feutre, par-dessus tout le fond */}
        <div aria-hidden className="film-grain pointer-events-none fixed inset-0 -z-10" />
        <SmoothScroll />
        <AppProviders>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </AppProviders>
        <CustomCursor />
      </body>
    </html>
  );
}
