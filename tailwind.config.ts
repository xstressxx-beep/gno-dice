import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";

// Configuration Tailwind CSS v3 — thème « Lapis & Acétate ».
// Inspiré du matériel de casino : le tapis de feutre bleu outremer et les dés
// de précision en acétate rubis translucide. Les couleurs de base sont des
// variables CSS (src/app/globals.css) : on change une couleur à un seul endroit.
// Le format `hsl(var(--x) / <alpha-value>)` permet la transparence (`bg-primary/20`).
const hsl = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: hsl("border"),
        input: hsl("input"),
        ring: hsl("ring"),
        background: hsl("background"),
        foreground: hsl("foreground"),
        primary: { DEFAULT: hsl("primary"), foreground: hsl("primary-foreground") },
        secondary: { DEFAULT: hsl("secondary"), foreground: hsl("secondary-foreground") },
        destructive: { DEFAULT: hsl("destructive"), foreground: hsl("destructive-foreground") },
        muted: { DEFAULT: hsl("muted"), foreground: hsl("muted-foreground") },
        accent: { DEFAULT: hsl("accent"), foreground: hsl("accent-foreground") },
        popover: { DEFAULT: hsl("popover"), foreground: hsl("popover-foreground") },
        card: { DEFAULT: hsl("card"), foreground: hsl("card-foreground") },
        // Rouge du dé : uniquement pour le dé et l'action « Lancer »
        casino: { DEFAULT: hsl("casino"), deep: hsl("casino-deep"), foreground: hsl("casino-foreground") },
        win: hsl("win"),
        info: hsl("info"),
        // Palette nommée
        lapis: { DEFAULT: "#070C2B", 950: "#04071C", 900: "#070C2B", 800: "#0C1440", 700: "#121C55", 600: "#1B276E" },
        felt: { DEFAULT: "#1630B8", deep: "#0E1F7A", light: "#3A54E6" },
        ruby: { DEFAULT: "#E3173E", deep: "#9E0A27", light: "#FF5470" },
        signal: "#9DB0FF",
        haze: "#8C93BD",
        // Craie : du blanc cassé au gris bleuté (texte, filets, surfaces claires)
        chalk: {
          DEFAULT: "#EFEADF",
          50: "#FBF9F4",
          100: "#EFEADF",
          200: "#DCD6C8",
          300: "#C2BFC4",
          400: "#A3A6C2",
          500: "#8C93BD",
          600: "#5E6799",
          700: "#3B4479",
          800: "#232C5C",
          900: "#151C45",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 6px)",
        sm: "calc(var(--radius) - 10px)",
        panel: "1.75rem",
      },
      fontFamily: {
        sans: ["var(--font-instrument)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        casino: "0 18px 40px -12px rgba(227, 23, 62, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
        luxe: "0 40px 80px -30px rgba(2, 4, 20, 0.9), inset 0 1px 0 rgba(239, 234, 223, 0.06)",
        signal: "0 0 0 1px rgba(157, 176, 255, 0.4), 0 8px 30px -8px rgba(157, 176, 255, 0.45)",
      },
      keyframes: {
        // Reflet qui traverse un bouton
        sweep: {
          "0%, 55%": { transform: "translateX(-120%) skewX(-20deg)" },
          "100%": { transform: "translateX(220%) skewX(-20deg)" },
        },
        // Anneau qui s'agrandit et disparaît (bouton Lancer)
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "100%": { transform: "scale(1.08, 1.4)", opacity: "0" },
        },
        "skeleton-wave": {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
      },
      animation: {
        sweep: "sweep 3.4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
        "skeleton-wave": "skeleton-wave 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
