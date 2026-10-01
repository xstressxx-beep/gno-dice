import { useId, type CSSProperties } from "react";

// Position des points (sur un carré de 100 x 100) pour chaque face du dé.
// Aussi utilisé par le dé 3D (Dice3D.tsx).
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
  /** ivory : dé classique, gold : dé sélectionné */
  variant?: "ivory" | "gold";
  className?: string;
  style?: CSSProperties;
  /** Texte lu par les lecteurs d'écran ; sans titre, le dé est décoratif. */
  label?: string;
};

/** Une face de dé dessinée en SVG. */
export function Die({ value, size = 64, variant = "ivory", className, style, label }: DieProps) {
  const id = useId();
  const face = PIPS[value] ?? PIPS[1];
  const gold = variant === "gold";

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
          {gold ? (
            <>
              <stop offset="0" stopColor="#fde7a1" />
              <stop offset="0.45" stopColor="#f5c542" />
              <stop offset="1" stopColor="#b8860b" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#fffdf7" />
              <stop offset="1" stopColor="#ddd3bb" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`${id}-pip`} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor={value === 1 && !gold ? "#ff6b6b" : "#3a3a3a"} />
          <stop offset="1" stopColor={value === 1 && !gold ? "#b3121f" : "#0d0d0d"} />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="20" fill={`url(#${id}-body)`} />
      <rect x="4" y="4" width="92" height="92" rx="20" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
      {face.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={value === 1 ? 11 : 9} fill={`url(#${id}-pip)`} />
      ))}
    </svg>
  );
}
