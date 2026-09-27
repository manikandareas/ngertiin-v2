import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { MouseEventHandler } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

export function BackHeader({
  to,
  label,
  onClick,
  sticky = false,
}: {
  to: string;
  label: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  sticky?: boolean;
}) {
  return (
    <header
      className={`${sticky ? "sticky top-0 z-30" : "z-20 shrink-0"} flex h-12 items-center border-b border-muted bg-background px-4 sm:px-8`}
    >
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 gap-2 px-2 text-xs font-semibold tracking-normal normal-case text-muted-foreground"
      >
        <Link to={to} onClick={onClick}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.5} aria-hidden="true" />
          {label}
        </Link>
      </Button>
    </header>
  );
}
