import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cinzel, Inter } from "next/font/google";
import { WalletProvider } from "@/components/WalletProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

// Polices : Cinzel (titres, style casino) et Inter (texte).
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["600", "700", "800"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GNO-DICE — le jeu de dés décentralisé sur Gno.land",
  description:
    "Choisis un chiffre de 1 à 6, mise entre 1 et 10 GNOT et gagne 5 fois ta mise si le dé tombe sur ton chiffre. Un lancer toutes les 10 minutes, 100 % on-chain.",
};

export const viewport: Viewport = {
  themeColor: "#05080a",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" className={`${cinzel.variable} ${inter.variable}`}>
      <body>
        <WalletProvider>
          <Header />
          {children}
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
