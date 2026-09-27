import type * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-32 w-full rounded-lg border-2 border-input bg-transparent px-3 py-2 text-base motion-safe:transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:shadow-none focus-visible:bg-[color-mix(in_srgb,var(--accent)_6%,var(--background))] focus-visible:caret-link aria-invalid:focus-visible:border-destructive disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
