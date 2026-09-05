import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-button border-2 border-transparent text-nav-label font-extrabold uppercase motion-safe:transition-[background-color,box-shadow,transform] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_4px_0_var(--primary-edge)] hover:bg-primary-hover active:translate-y-1 active:shadow-none",
        outline:
          "border-border bg-background text-link shadow-[0_3px_0_var(--border)] hover:bg-accent active:translate-y-[3px] active:shadow-none",
        secondary: "border-border bg-muted text-foreground hover:bg-border active:bg-input/30",
        ghost: "text-link hover:bg-accent",
        link: "text-link normal-case tracking-normal underline-offset-4 hover:underline",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-12 px-4",
        sm: "h-10 px-3 text-caption",
        lg: "h-13 px-6",
        icon: "size-12 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
