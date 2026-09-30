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
        // Or : action principale
        default:
          "bg-gold-gradient text-primary-foreground shadow-gold hover:-translate-y-px hover:text-primary-foreground hover:shadow-gold-lg active:translate-y-0",
        // Rouge casino : le bouton JOUER
        casino:
          "border border-gold-300/70 bg-casino-gradient font-display uppercase tracking-[0.14em] text-casino-foreground shadow-casino hover:text-casino-foreground",
        outline:
          "border border-primary/35 bg-black/30 text-foreground hover:border-primary/70 hover:bg-accent hover:text-accent-foreground",
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
