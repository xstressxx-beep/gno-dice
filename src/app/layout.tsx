import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cinzel, Inter } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import { CustomCursor } from "@/components/CustomCursor";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LuxuryBackdrop } from "@/components/LuxuryBackdrop";
import { INTRO_KEY, Preloader } from "@/components/Preloader";
import "./globals.css";

// Polices : Cinzel (logo et touches casino) et Inter (titres et texte).
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["600", "700", "800"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GNO-DICE — le jeu de dés décentralisé sur Gno.land",
  description:
    "Choisis un chiffre de 1 à 6, mise entre 1 et 10 GNOT et gagne 5 fois ta mise si le dé tombe sur ton chiffre. Un lancer toutes les 10 minutes, 100 % on-chain.",
};

export const viewport: Viewport = {
  themeColor: "#040404",
};

// Exécuté avant l'affichage : si l'intro a déjà été vue pendant cette visite,
// on la masque tout de suite (sinon elle clignoterait une fraction de seconde).
const introScript = `try{if(sessionStorage.getItem("${INTRO_KEY}"))document.documentElement.classList.add("intro-seen")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // suppressHydrationWarning : la classe « intro-seen » est ajoutée par le script ci-dessous
    <html lang="fr" className={`dark ${cinzel.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Preloader />
        <LuxuryBackdrop />
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
