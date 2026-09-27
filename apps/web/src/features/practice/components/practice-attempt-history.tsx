import { ArrowRight02Icon, Clock01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PracticeAttempt, PracticeDetail } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";

const statusLabels = {
  active: "Sedang dikerjakan",
  completed: "Selesai",
  evaluation_failed: "Penilaian belum berhasil",
  evaluating: "Sedang dinilai",
};
type Props = {
  practice: PracticeDetail;
  attempts?: PracticeAttempt[];
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
};
export function PracticeAttemptHistory({ practice, attempts, pending, failed, onRetry }: Props) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold">
        Riwayat belajar{" "}
        <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
          {attempts ? `${attempts.length} sesi` : ""}
        </span>
      </h2>
      <div className="mt-4">
        {pending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Memuat riwayat…
          </p>
        ) : null}
        {failed ? (
          <div role="alert" className="text-sm text-destructive">
            Riwayat belum dapat dimuat.
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Coba lagi
            </Button>
          </div>
        ) : null}
        {attempts?.map((attempt) => {
          const understood = Object.values(attempt.answers).filter(
            (answer) => answer.type === "flashcard" && answer.understood,
          ).length;
          return (
            <Link
              key={attempt.id}
              to={`/modules/${practice.moduleId}/practice/${practice.id}/attempts/${attempt.id}`}
              className="flex items-center gap-3 border-t py-4 text-sm hover:bg-muted/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {attempt.status === "completed" ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="size-4"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={Clock01Icon}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="size-4"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <time className="font-semibold" dateTime={attempt.startedAt}>
                  {new Date(attempt.startedAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {statusLabels[attempt.status]}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {attempt.status === "active" ? (
                  <span className="text-xs text-link">Lanjutkan</span>
                ) : practice.kind === "flashcard" && attempt.status === "completed" ? (
                  <>
                    <p className="font-bold">
                      {understood} / {practice.itemCount}
                    </p>
                    <p className="text-xs text-muted-foreground">kartu dipahami</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold">
                      {attempt.score === null ? "—" : `${attempt.score}/100`}
                    </p>
                    <p className="text-xs text-muted-foreground">nilai akhir</p>
                  </>
                )}
              </div>
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                strokeWidth={1.5}
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
            </Link>
          );
        })}
        {attempts?.length === 0 ? (
          <p className="border-t py-5 text-sm text-muted-foreground">
            Belum ada sesi belajar. Riwayatmu akan muncul setelah mulai latihan.
          </p>
        ) : null}
      </div>
    </section>
  );
}
