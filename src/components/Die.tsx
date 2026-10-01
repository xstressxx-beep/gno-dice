import { useId, type CSSProperties } from "react";

// Position des points (sur un carré de 100 x 100) pour chaque face du dé.
// Aussi utilisé par le dé 3D (DieScene.tsx).
export const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

type DieProps = {
  value: number;
  size?: number;
  /** chalk : face claire (au repos), ruby : acétate rubis (choisi / gagnant) */
  variant?: "chalk" | "ruby" | "ghost";
  className?: string;
  style?: CSSProperties;
  /** Texte lu par les lecteurs d'écran ; sans titre, le dé est décoratif. */
  label?: string;
};

const LOOKS = {
  chalk: { from: "#FBF9F4", to: "#DCD6C8", pip: "#121C55", edge: "rgba(7,12,43,0.18)" },
  ruby: { from: "#FF5470", to: "#B50E31", pip: "#FBF9F4", edge: "rgba(255,255,255,0.35)" },
  ghost: { from: "rgba(239,234,223,0.06)", to: "rgba(239,234,223,0.02)", pip: "#8C93BD", edge: "rgba(239,234,223,0.18)" },
};

/** Une face de dé dessinée en SVG. */
export function Die({ value, size = 64, variant = "chalk", className, style, label }: DieProps) {
  const id = useId();
  const face = PIPS[value] ?? PIPS[1];
  const look = LOOKS[variant];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={look.from} />
          <stop offset="1" stopColor={look.to} />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="90" height="90" rx="16" fill={`url(#${id}-body)`} />
      <rect x="5.5" y="5.5" width="89" height="89" rx="15.5" fill="none" stroke={look.edge} strokeWidth="1.5" />
      {face.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={value === 1 ? 12 : 8.5} fill={look.pip} />
      ))}
    </svg>
  );
}
