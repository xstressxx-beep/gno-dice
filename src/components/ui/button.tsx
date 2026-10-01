import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Bouton shadcn/ui, décliné aux couleurs du casino.
// `asChild` permet d'appliquer le style à un autre élément (ex. un lien <a>).
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold no-underline transition-[transform,box-shadow,background-color,color,opacity] duration-200 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Craie : action principale de l'interface
        default: "bg-chalk text-lapis hover:bg-white hover:text-lapis active:scale-[0.97]",
        // Rubis : réservé au dé et à l'action de jeu
        casino: "bg-ruby text-white shadow-casino hover:bg-[#f0234b] hover:text-white active:scale-[0.97]",
        outline:
          "border border-border bg-transparent text-foreground hover:border-chalk/50 hover:bg-white/[0.04] hover:text-foreground active:scale-[0.97]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-secondary-foreground",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        xl: "h-16 px-8 text-lg sm:text-xl",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
