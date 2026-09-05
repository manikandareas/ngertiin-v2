import type { JourneySummary as JourneyData, ModuleStatus } from "@ngertiin/contracts/api";
import { Archive, ArrowRight, BookOpen, Check, Clock3, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { nextLearningRoute } from "../next-learning-route";

export function JourneySummary({
  data,
  status,
  archiving,
  archiveError,
  onArchive,
}: {
  data: JourneyData;
  status: ModuleStatus;
  archiving: boolean;
  archiveError: string | null;
  onArchive: () => Promise<void>;
}) {
  const destination = nextLearningRoute(data.nextAction);
  const hasActiveNode =
    "nodeId" in data.nextAction &&
    data.nodes.some((node) => "nodeId" in data.nextAction && node.id === data.nextAction.nodeId);
  const completed = data.nextAction.type === "module_completed";
  const canLearn = status === "ready";
  return (
    <aside
      className="rounded-3xl border-2 bg-background p-5 shadow-[0_4px_0_var(--border)] md:sticky md:top-8 md:p-6"
      aria-label="Ringkasan modul"
    >
      <div className="flex items-center justify-between gap-4">
        <div
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-secondary text-link shadow-[0_3px_0_var(--border)]"
        >
          <BookOpen className="size-6.5" />
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-bold text-muted-foreground">
          {
            { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjutan" }[
              data.module.difficulty
            ]
          }
        </span>
      </div>
      <h1 className="mt-5 break-words font-display text-2xl font-extrabold leading-tight tracking-tight">
        {data.module.title}
      </h1>
      {data.module.description ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{data.module.description}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-2">
          <Layers aria-hidden="true" className="size-4" />
          {data.progress.totalCoreNodes} node utama
        </span>
        {data.module.estimatedMinutes ? (
          <span className="flex items-center gap-2">
            <Clock3 aria-hidden="true" className="size-4" />
            {data.module.estimatedMinutes} menit
          </span>
        ) : null}
      </div>
      <div className="mt-6 border-t pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Progress belajar</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.progress.completedCoreNodes} dari {data.progress.totalCoreNodes} node selesai
            </p>
          </div>
          <strong className="font-display text-3xl font-extrabold leading-none tabular-nums">
            {Math.round(data.progress.percentage)}
            <span className="ml-0.5 text-base text-muted-foreground">%</span>
          </strong>
        </div>
        <div
          role="progressbar"
          aria-label="Progress node utama"
          aria-valuenow={data.progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-4 h-2 overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${data.progress.percentage}%` }}
          />
        </div>
      </div>
      {status === "archived" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Modul diarsipkan. Journey dan riwayat tersedia dalam mode baca saja.
        </p>
      ) : completed ? (
        <p className="mt-4 flex items-center gap-2 font-bold text-success-foreground">
          <Check aria-hidden="true" className="size-5" />
          Semua node utama sudah selesai.
        </p>
      ) : !hasActiveNode && destination ? (
        <Button asChild className="mt-4 w-full">
          <Link to={destination}>
            {data.nextAction.type === "offer_optional_review"
              ? "Tinjau pengayaan"
              : data.nextAction.type === "wait_for_adaptive"
                ? "Lihat status pengayaan"
                : "Lanjutkan belajar"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
      {canLearn ? (
        <Button
          disabled={archiving}
          onClick={onArchive}
          variant="ghost"
          size="sm"
          className="mt-4 h-9 px-0 text-xs normal-case text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Archive aria-hidden="true" />
          {archiving ? "Mengarsipkan…" : "Arsipkan modul"}
        </Button>
      ) : null}
      {archiveError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {archiveError}
        </p>
      ) : null}
    </aside>
  );
}
