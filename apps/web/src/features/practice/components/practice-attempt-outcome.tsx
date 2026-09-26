import type { PracticeAttempt, PracticeDetail } from "@ngertiin/contracts/api";
import { Button } from "../../../components/ui/button";
import { PracticeAttemptResult } from "./practice-attempt-result";

type Props = {
  data: PracticeDetail;
  session: PracticeAttempt;
  busy: boolean;
  error: string | null;
  onRetryEvaluation: () => void;
};

export function PracticeAttemptOutcome({ data, session, busy, error, onRetryEvaluation }: Props) {
  return (
    <>
      {session.status === "evaluating" ? (
        <div role="status" className="mt-8 rounded-2xl border bg-card p-6">
          <p className="font-medium">Jawaban sedang dinilai</p>
          <p className="mt-1 text-sm text-muted-foreground">Hasil akan muncul otomatis.</p>
        </div>
      ) : null}
      {session.status === "evaluation_failed" ? (
        <div className="mt-8 rounded-2xl border bg-card p-6">
          <p className="font-medium">Penilaian belum berhasil</p>
          <p className="mt-1 text-sm text-muted-foreground">Jawabanmu tetap tersimpan.</p>
          <Button className="mt-4" disabled={busy} onClick={onRetryEvaluation}>
            Coba nilai lagi
          </Button>
        </div>
      ) : null}
      {session.status === "completed" ? (
        <PracticeAttemptResult data={data} session={session} />
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
