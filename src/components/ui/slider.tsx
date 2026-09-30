"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

// Curseur (Radix UI) : utilisable à la souris, au doigt et au clavier (flèches).

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex w-full touch-none select-none items-center py-2 data-[disabled]:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full border border-primary/20 bg-black/60">
        <SliderPrimitive.Range className="absolute h-full bg-gold-gradient" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block size-6 cursor-grab rounded-full border-2 border-gold-200 bg-gold-gradient shadow-gold transition-transform active:cursor-grabbing",
          "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none",
        )}
        aria-label={props["aria-label"]}
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
