import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";

// Configuration Tailwind CSS v3 + thème shadcn/ui « casino de luxe ».
// Les couleurs principales sont des variables CSS définies dans
// src/app/globals.css : on change une couleur à un seul endroit.
// Le format `hsl(var(--x) / <alpha-value>)` permet la transparence,
// ex. `bg-primary/20` = or à 20 %.
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
        // Couleurs propres au casino
        casino: { DEFAULT: hsl("casino"), deep: hsl("casino-deep"), foreground: hsl("casino-foreground") },
        win: hsl("win"),
        info: hsl("info"),
        gold: {
          50: "#fffaeb",
          100: "#fdf0c8",
          200: "#fde7a1",
          300: "#f9d56e",
          400: "#f5c542",
          500: "#e0aa24",
          600: "#b8860b",
          700: "#8a6408",
          800: "#5c4306",
          900: "#2e2103",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-cinzel)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #fde7a1 0%, #f5c542 42%, #b8860b 100%)",
        "gold-sheen": "linear-gradient(110deg, #b8860b 0%, #fde7a1 20%, #f5c542 40%, #b8860b 60%, #fde7a1 80%, #f5c542 100%)",
        "casino-gradient": "linear-gradient(180deg, #ef3346 0%, #c8102e 55%, #8a0a1e 100%)",
      },
      boxShadow: {
        gold: "0 0 24px rgba(245, 197, 66, 0.35)",
        "gold-lg": "0 0 48px rgba(245, 197, 66, 0.45)",
        casino: "0 0 28px rgba(220, 20, 45, 0.55)",
        luxe: "0 30px 60px -20px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      },
      keyframes: {
        // Reflet doré qui glisse sur un texte ou un bouton
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        sweep: {
          "0%, 55%": { transform: "translateX(-120%) skewX(-20deg)" },
          "100%": { transform: "translateX(220%) skewX(-20deg)" },
        },
        // Anneau qui s'agrandit et disparaît (bouton JOUER)
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.65" },
          "100%": { transform: "scale(1.12, 1.45)", opacity: "0" },
        },
        "skeleton-wave": {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 6s linear infinite",
        sweep: "sweep 3.4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
        "skeleton-wave": "skeleton-wave 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
