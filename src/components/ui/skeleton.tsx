import * as React from "react";
import { cn } from "@/lib/utils";

// Bloc gris animé affiché pendant un chargement.

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-skeleton-wave rounded-md bg-[linear-gradient(90deg,rgba(255,255,255,0.03),rgba(157,176,255,0.08),rgba(255,255,255,0.03))] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
