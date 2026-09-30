"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

// Filet de séparation doré (Radix UI).

function Separator({ className, orientation = "horizontal", decorative = true, ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 from-transparent via-primary/45 to-transparent",
        orientation === "horizontal" ? "h-px w-full bg-gradient-to-r" : "h-full w-px bg-gradient-to-b",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
