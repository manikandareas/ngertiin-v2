import { RotateLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { JSX } from "react";
import { Button } from "../../../components/ui/button";

interface AttemptResultActionsProps {
  canRetry: boolean;
  onReview: () => void;
  onRetry: () => void;
}

const actionClassName =
  "h-auto min-h-10 min-w-0 w-full max-w-full whitespace-normal rounded-none px-3 py-2 text-center font-semibold normal-case tracking-normal text-muted-foreground";

export function AttemptResultActions({
  canRetry,
  onReview,
  onRetry,
}: AttemptResultActionsProps): JSX.Element {
  return (
    <fieldset
      className="grid auto-cols-fr grid-flow-col items-stretch divide-x divide-border"
      aria-label="Pilihan belajar lainnya"
    >
      <Button variant="ghost" size="sm" className={actionClassName} onClick={onReview}>
        Lihat kembali materi &amp; soal
      </Button>
      {canRetry ? (
        <Button onClick={onRetry} variant="ghost" size="sm" className={actionClassName}>
          <HugeiconsIcon
            icon={RotateLeft01Icon}
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0"
          />
          Kerjakan ulang assessment
        </Button>
      ) : null}
    </fieldset>
  );
}
