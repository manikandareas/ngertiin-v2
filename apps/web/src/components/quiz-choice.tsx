import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

/** Shared answer surface for node assessments and practice quizzes. */
export function QuizChoice({ className, ...props }: ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Callers supply the native radio input and its visible label as children.
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-sm leading-relaxed motion-safe:transition-colors hover:bg-muted has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-default has-[:disabled]:hover:bg-card has-[:disabled:checked]:hover:bg-accent sm:gap-5 sm:p-5 sm:text-base",
        className,
      )}
      {...props}
    />
  );
}
