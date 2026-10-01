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
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-chalk/15">
        <SliderPrimitive.Range className="absolute h-full bg-ruby" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block size-5 cursor-grab rounded-full border-[5px] border-ruby bg-chalk shadow-[0_0_0_6px_rgba(227,23,62,0.15)] transition-[transform,box-shadow] active:scale-125 active:cursor-grabbing active:shadow-[0_0_0_10px_rgba(227,23,62,0.2)]",
          "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none",
        )}
        aria-label={props["aria-label"]}
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
