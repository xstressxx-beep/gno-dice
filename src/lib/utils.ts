import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine des classes CSS (utilisé par tous les composants shadcn/ui).
 * Exemple : cn("p-2", actif && "bg-primary", "p-4") -> "bg-primary p-4"
 * (twMerge garde la dernière classe Tailwind quand deux se contredisent).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
