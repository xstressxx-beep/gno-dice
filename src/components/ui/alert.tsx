import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Encadré de message (info, succès, erreur).
const alertVariants = cva(
  "relative w-full rounded-2xl border px-4 py-3 text-sm [&_a]:font-semibold [&_strong]:font-semibold [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/5 text-foreground [&>svg]:text-primary",
        info: "border-info/35 bg-info/[0.07] text-chalk [&>svg]:text-info",
        success: "border-win/40 bg-win/[0.08] text-chalk [&>svg]:text-win",
        destructive: "border-destructive/45 bg-destructive/[0.08] text-[#ffd6de] [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("mb-1 font-semibold leading-snug", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
