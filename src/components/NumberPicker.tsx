"use client";

// Choix du chiffre (1 à 6) : un groupe de boutons Radix UI (ToggleGroup),
// utilisable aussi au clavier. Le chiffre choisi passe en acétate rubis ;
// un repère glisse d'une face à l'autre (layoutId de Framer Motion).

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { GAME } from "@/lib/config";
import { haptic, sparkBurstFrom } from "@/lib/fx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Die } from "./Die";

type NumberPickerProps = {
  value: number | null;
  onChange: (face: number) => void;
  disabled?: boolean;
};

export function NumberPicker({ value, onChange, disabled }: NumberPickerProps) {
  const t = useTranslations("picker");
  return (
    <ToggleGroup
      type="single"
      value={value === null ? "" : String(value)}
      // Radix renvoie "" si on reclique sur le chiffre choisi : on garde alors le choix.
      onValueChange={(v) => v && onChange(Number(v))}
      disabled={disabled}
      aria-label={t("group")}
      className="grid grid-cols-6 gap-2 sm:gap-2.5"
    >
      {GAME.faces.map((face) => {
        const selected = value === face;
        return (
          <ToggleGroupItem
            key={face}
            value={String(face)}
            aria-label={t("face", { face })}
            onClick={(e) => {
              sparkBurstFrom(e.currentTarget, { count: 10, spread: 50 });
              haptic(8);
            }}
            className="relative h-auto min-w-0 rounded-xl border border-transparent bg-transparent p-1.5 hover:bg-white/[0.04] data-[state=on]:bg-transparent sm:p-2"
          >
            {selected && (
              <motion.span
                layoutId="picked-face"
                className="absolute inset-0 rounded-xl border border-ruby/60 bg-ruby/10"
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
              />
            )}
            <motion.span
              className="relative block w-full"
              animate={selected ? { scale: 1.06, rotate: 0 } : { scale: 1, rotate: 0 }}
              whileHover={disabled ? undefined : { y: -3, rotate: -6 }}
              whileTap={disabled ? undefined : { scale: 0.86, rotate: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
            >
              <Die value={face} size={52} variant={selected ? "ruby" : "chalk"} className="mx-auto h-auto w-full max-w-[52px]" />
            </motion.span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
