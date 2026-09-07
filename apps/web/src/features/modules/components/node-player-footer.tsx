import type { PublicActivity } from "@ngertiin/contracts/api";
import type { JSX, ReactNode } from "react";

interface NodePlayerFooterProps {
  errorMessage: string | null;
  reviewing: boolean;
  activityType: PublicActivity["type"] | undefined;
  children: ReactNode;
}

function getHint({
  reviewing,
  activityType,
}: Omit<NodePlayerFooterProps, "children" | "errorMessage">): string | null {
  if (reviewing || !activityType || activityType === "lesson" || activityType === "flashcard")
    return null;
  return "Jawaban dinilai bersama di akhir node.";
}

export function NodePlayerFooter({
  errorMessage,
  reviewing,
  activityType,
  children,
}: NodePlayerFooterProps): JSX.Element {
  const hint = getHint({ reviewing, activityType });
  return (
    <footer className="shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 md:pb-10">
      <div className="mx-auto max-w-xl">
        {errorMessage ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {hint ? (
          <div className="mb-4 text-xs text-muted-foreground" aria-live="polite">
            {hint}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
      </div>
    </footer>
  );
}
