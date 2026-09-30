"use client";

// Choix du chiffre (1 à 6) : un groupe de boutons Radix UI (ToggleGroup),
// utilisable aussi au clavier avec les flèches.

import { motion } from "framer-motion";
import { GAME } from "@/lib/config";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Die } from "./Die";

type NumberPickerProps = {
  value: number | null;
  onChange: (face: number) => void;
  disabled?: boolean;
};

export function NumberPicker({ value, onChange, disabled }: NumberPickerProps) {
  return (
    <ToggleGroup
      type="single"
      value={value === null ? "" : String(value)}
      // Radix renvoie "" si on reclique sur le chiffre choisi : on garde alors le choix.
      onValueChange={(v) => v && onChange(Number(v))}
      disabled={disabled}
      aria-label="Chiffre choisi"
      className="grid grid-cols-6 gap-1.5 sm:gap-3"
    >
      {GAME.faces.map((face) => {
        const selected = value === face;
        return (
          <ToggleGroupItem
            key={face}
            value={String(face)}
            aria-label={`Chiffre ${face}`}
            className="relative h-auto min-w-0 rounded-md border border-primary/15 bg-black/45 px-1 py-2.5 hover:border-primary/40 hover:bg-accent/50 data-[state=on]:border-gold-300 data-[state=on]:bg-primary/10 data-[state=on]:shadow-gold sm:py-3.5"
          >
            <motion.span
              className="block w-full"
              animate={selected ? { scale: 1.1, y: -2, rotate: 0 } : { scale: 1, y: 0, rotate: 0 }}
              whileHover={disabled ? undefined : { y: -4, rotate: -8 }}
              whileTap={disabled ? undefined : { scale: 0.88 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
            >
              <Die
                value={face}
                size={52}
                variant={selected ? "gold" : "ivory"}
                className="mx-auto h-auto w-full max-w-[40px] drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)] sm:max-w-[52px]"
              />
            </motion.span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
