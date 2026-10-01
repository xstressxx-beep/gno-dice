"use client";

// Choix de la mise : la mise en grand (compteur à rouleaux), boutons − / +,
// curseur (Radix UI Slider) et quatre jetons aux couleurs du tapis.

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { haptic, sparkBurstFrom } from "@/lib/fx";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

type BetControlProps = {
  value: number;
  min: number;
  max: number;
  onChange: (bet: number) => void;
  disabled?: boolean;
};

// Jetons : valeur, couleur du centre, couleur des encoches du bord.
const CHIPS = [
  { value: 1, face: "#EFEADF", edge: "#3A54E6", text: "#070C2B" },
  { value: 2, face: "#3A54E6", edge: "#EFEADF", text: "#FFFFFF" },
  { value: 5, face: "#E3173E", edge: "#EFEADF", text: "#FFFFFF" },
  { value: 10, face: "#0C1440", edge: "#E3173E", text: "#EFEADF" },
];

export function BetControl({ value, min, max, onChange, disabled }: BetControlProps) {
  const t = useTranslations("bet");
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {/* − mise + */}
        <div className="flex items-center gap-1">
          <StepButton label={t("decrease")} onClick={() => onChange(clamp(value - 1))} disabled={disabled || value <= min}>
            <Minus className="size-4" />
          </StepButton>
          <p className="min-w-[6.5rem] text-center" aria-live="polite">
            <AnimatedNumber value={value} className="display-soft text-[2.6rem] leading-none text-chalk" />
            <span className="ml-1.5 text-sm text-haze">GNOT</span>
          </p>
          <StepButton label={t("increase")} onClick={() => onChange(clamp(value + 1))} disabled={disabled || value >= max}>
            <Plus className="size-4" />
          </StepButton>
        </div>

        {/* Jetons */}
        <div className="flex gap-2 sm:gap-2.5">
          {CHIPS.filter((c) => c.value >= min && c.value <= max).map((chip) => {
            const active = value === chip.value;
            return (
              <motion.button
                key={chip.value}
                type="button"
                onClick={(e) => {
                  onChange(chip.value);
                  sparkBurstFrom(e.currentTarget, { count: 10, spread: 44, colors: [chip.face, chip.edge, "#FBF9F4"] });
                  haptic(8);
                }}
                disabled={disabled}
                aria-label={t("chip", { value: chip.value })}
                aria-pressed={active}
                className={cn(
                  "relative grid size-11 place-items-center rounded-full text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 sm:size-12",
                  active && "ring-2 ring-chalk ring-offset-2 ring-offset-background",
                )}
                style={{
                  color: chip.text,
                  // Bord à encoches, comme un vrai jeton de casino
                  background: `radial-gradient(circle, ${chip.face} 0 54%, transparent 55%), repeating-conic-gradient(${chip.edge} 0 15deg, ${chip.face} 15deg 45deg)`,
                  boxShadow: "0 6px 14px -4px rgba(2,4,20,0.7), inset 0 0 0 1px rgba(255,255,255,0.12)",
                }}
                animate={{ y: active ? -5 : 0 }}
                whileHover={disabled ? undefined : { y: -6, rotate: -18 }}
                whileTap={disabled ? undefined : { scale: 0.88, rotate: 30 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {chip.value}
              </motion.button>
            );
          })}
        </div>
      </div>

      <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(clamp(v))} disabled={disabled} aria-label={t("slider")} />
    </div>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full border border-border text-chalk transition-colors hover:border-chalk/50 hover:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-30"
      whileTap={{ scale: 0.85 }}
    >
      {children}
    </motion.button>
  );
}
