import * as React from "react";
import { cn } from "@/lib/utils";

// Champ de saisie (utilisé sur la page /admin).

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-lapis-950/40 px-3 py-2 text-base text-foreground shadow-inner transition-colors",
        "placeholder:text-muted-foreground focus-visible:border-primary/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
