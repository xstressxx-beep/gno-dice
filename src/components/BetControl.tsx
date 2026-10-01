"use client";

// Choix de la mise : boutons − / +, curseur (Radix UI Slider) et jetons de casino.

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { haptic, sparkBurstFrom } from "@/lib/fx";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

type BetControlProps = {
  value: number;
  min: number;
  max: number;
  onChange: (bet: number) => void;
  disabled?: boolean;
};

// Jetons : valeur et couleur (comme au casino).
const CHIPS = [
  { value: 1, color: "#2563eb" },
  { value: 2, color: "#dc2626" },
  { value: 5, color: "#16a34a" },
  { value: 10, color: "#161616" },
];

export function BetControl({ value, min, max, onChange, disabled }: BetControlProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 sm:justify-between">
        {/* − mise + */}
        <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-black/45 p-1">
          <Button variant="outline" size="icon" onClick={() => onChange(clamp(value - 1))} disabled={disabled || value <= min} aria-label="Diminuer la mise">
            <Minus />
          </Button>
          <p className="min-w-[5.5rem] text-center" aria-live="polite">
            <AnimatedNumber value={value} className="gold-text font-display text-3xl font-extrabold tabular-nums" />
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">GNOT</span>
          </p>
          <Button variant="outline" size="icon" onClick={() => onChange(clamp(value + 1))} disabled={disabled || value >= max} aria-label="Augmenter la mise">
            <Plus />
          </Button>
        </div>

        {/* Jetons */}
        <div className="flex gap-2.5 sm:gap-3">
          {CHIPS.filter((c) => c.value >= min && c.value <= max).map((chip) => {
            const active = value === chip.value;
            const gold = chip.value === 10;
            return (
              <motion.button
                key={chip.value}
                type="button"
                onClick={(e) => {
                  onChange(chip.value);
                  // Étincelles aux couleurs du jeton
                  sparkBurstFrom(e.currentTarget, { count: 10, spread: 45, colors: ["#fff7d6", chip.color === "#161616" ? "#f5c542" : chip.color, "#fde7a1", "#f5c542"] });
                  haptic(8);
                }}
                disabled={disabled}
                aria-label={`Miser ${chip.value} GNOT`}
                aria-pressed={active}
                className={cn(
                  "grid size-11 place-items-center rounded-full border-[3px] border-dashed text-sm font-extrabold [text-shadow:0_1px_2px_rgba(0,0,0,0.7)] disabled:cursor-not-allowed disabled:opacity-50 sm:size-12",
                  gold ? "border-gold-300 text-gold-200" : "border-white/85 text-white",
                  active && "ring-2 ring-gold-300 ring-offset-2 ring-offset-black",
                )}
                style={{
                  background: `radial-gradient(circle, ${chip.color} 0 52%, color-mix(in srgb, ${chip.color} 65%, black) 53% 100%)`,
                  boxShadow: `0 5px 12px rgba(0,0,0,0.55), inset 0 0 0 3px ${chip.color}`,
                }}
                animate={{ y: active ? -5 : 0, scale: active ? 1.08 : 1 }}
                whileHover={disabled ? undefined : { y: -6, rotate: -14 }}
                whileTap={disabled ? undefined : { scale: 0.9, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {chip.value}
              </motion.button>
            );
          })}
        </div>
      </div>

      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(clamp(v))}
        disabled={disabled}
        aria-label="Mise en GNOT"
      />
      <div aria-hidden className="-mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
        <span>{min} GNOT</span>
        <span>{max} GNOT</span>
      </div>
    </div>
  );
}
