import type { JourneySummary as JourneyData, ModuleStatus } from "@ngertiin/contracts/api";
import { ArrowRight, Check, Clock3, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { nextLearningRoute } from "../next-learning-route";

export function JourneySummary({ data, status }: { data: JourneyData; status: ModuleStatus }) {
  const destination = nextLearningRoute(data.nextAction);
  const hasActiveNode =
    "nodeId" in data.nextAction &&
    data.nodes.some((node) => "nodeId" in data.nextAction && node.id === data.nextAction.nodeId);
  const completed = data.nextAction.type === "module_completed";
  return (
    <section className="min-w-0 pb-8" aria-label="Ringkasan modul">
      <h1 className="break-words text-balance font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
        {data.module.title}
      </h1>
      {data.module.description ? (
        <p className="mt-3 max-w-prose break-words text-pretty text-sm leading-6 text-muted-foreground">
          {data.module.description}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="font-bold text-foreground">
          {
            { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjutan" }[
              data.module.difficulty
            ]
          }
        </span>
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
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{data.progress.completedCoreNodes}</span>{" "}
            dari {data.progress.totalCoreNodes} node selesai
          </p>
          <strong className="shrink-0 text-sm font-extrabold tabular-nums">
            {Math.round(data.progress.percentage)}
            <span>%</span>
          </strong>
        </div>
        <div
          role="progressbar"
          aria-label="Progress node utama"
          aria-valuenow={data.progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2 overflow-hidden rounded-full bg-border"
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
        <Button asChild className="mt-5 w-full sm:w-auto">
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
    </section>
  );
}
