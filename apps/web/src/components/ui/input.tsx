import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-md border bg-transparent px-2.5 py-1 text-xs transition-colors file:h-6 file:text-xs file:font-medium focus-visible:ring-1 aria-invalid:ring-1 md:text-xs file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        type === "file" &&
          "h-10 cursor-pointer px-3 py-2 text-sm leading-6 text-muted-foreground align-middle file:mr-3 file:h-7 file:cursor-pointer file:align-middle file:rounded-md file:border file:border-border/60 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:leading-none file:text-foreground file:transition-colors hover:file:bg-secondary/80",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
