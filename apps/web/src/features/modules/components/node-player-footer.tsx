import type { PublicActivity } from "@ngertiin/contracts/api";
import type { JSX, ReactNode } from "react";

interface NodePlayerFooterProps {
  errorMessage: string | null;
  showResult: boolean;
  reviewing: boolean;
  activityType: PublicActivity["type"] | undefined;
  children: ReactNode;
}

function getHint({
  showResult,
  reviewing,
  activityType,
}: Omit<NodePlayerFooterProps, "children" | "errorMessage">): string | null {
  if (showResult) return "Luangkan waktu untuk memahami hasil belajarmu.";
  if (reviewing) return "Mode review · Jelajahi kembali setiap aktivitas.";
  if (!activityType || activityType === "lesson") return null;
  if (activityType === "flashcard") return "Balik kartu, ingat kembali, lalu lanjutkan.";
  return "Jawaban dinilai bersama di akhir node.";
}

export function NodePlayerFooter({
  errorMessage,
  showResult,
  reviewing,
  activityType,
  children,
}: NodePlayerFooterProps): JSX.Element {
  const hint = getHint({ showResult, reviewing, activityType });
  return (
    <footer className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-10">
      <div className="mx-auto max-w-2xl">
        {errorMessage ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {hint ? (
          <div className="mb-4 text-center text-xs text-muted-foreground" aria-live="polite">
            {hint}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>
      </div>
    </footer>
  );
}
