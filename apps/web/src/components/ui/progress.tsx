import { Progress as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  const percentage = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100));
  return (
    <Primitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      value={value}
      max={max}
      {...props}
    >
      <Primitive.Indicator
        className="size-full bg-primary motion-safe:transition-transform"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </Primitive.Root>
  );
}
