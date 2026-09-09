import type { AttemptResult } from "@ngertiin/contracts/api";
import type { JSX } from "react";
import { Button } from "../../../components/ui/button";
import { ApiProblemError } from "../../../lib/api";
import { AttemptResultActions } from "./attempt-result-actions";
import { AttemptSummary } from "./attempt-summary";

interface NodeAttemptResultProps {
  result: AttemptResult | undefined;
  error: Error | null;
  loading: boolean;
  readOnly: boolean;
  animate: boolean;
  onReload: () => void;
  onReview: () => void;
  onRetry: () => void;
}

export function NodeAttemptResult({
  result,
  error,
  loading,
  readOnly,
  animate,
  onReload,
  onReview,
  onRetry,
}: NodeAttemptResultProps): JSX.Element {
  const errorMessage =
    error instanceof ApiProblemError
      ? error.problem.detail
      : "Hasil assessment belum dapat dimuat.";

  return (
    <div className="space-y-5" aria-live="polite">
      {error ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
          <Button variant="outline" disabled={loading} onClick={onReload}>
            {loading ? "Memuat hasil…" : "Coba muat hasil lagi"}
          </Button>
        </div>
      ) : null}
      {result ? (
        <>
          <AttemptSummary result={result} animate={animate} />
          <AttemptResultActions
            canRetry={result.attempt.evaluationStatus === "completed" && !readOnly}
            onReview={onReview}
            onRetry={onRetry}
          />
        </>
      ) : null}
      {!result && !error ? <p role="status">Memuat hasil…</p> : null}
    </div>
  );
}
