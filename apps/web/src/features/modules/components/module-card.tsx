import type { ModuleSummary } from "@ngertiin/contracts/api";
import { BookOpen, ChevronRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { getModuleStatus, moduleDifficulties, moduleDurationTone } from "../module-presentation";
import { moduleOverviewRoute } from "../next-learning-route";

const badge =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-4";

export function ModuleCard({ module }: { module: ModuleSummary }) {
  const destination = moduleOverviewRoute(module);
  const progress = module.progress;
  const status = getModuleStatus(module);

  return (
    <Card className="before:absolute before:-top-[11px] before:-left-0.5 before:h-[11px] before:w-21 before:rounded-t-[10px_14px] before:border-2 before:border-border before:border-b-0 before:bg-card before:content-[''] motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:hover:-translate-y-[3px] motion-safe:hover:rotate-[0.4deg] relative mt-3 min-w-0 gap-0 rounded-tl-none px-5 py-5 sm:px-6">
      <h2 className="min-h-12 text-base font-semibold leading-6 tracking-tight">
        <Link
          to={destination}
          title={module.title ?? "Modul baru"}
          className="line-clamp-2 wrap-anywhere rounded-sm hover:text-link focus-visible:outline-2 focus-visible:outline-ring"
        >
          {module.title ?? "Modul baru"}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-2 min-h-10 wrap-anywhere text-sm leading-5 text-muted-foreground">
        {module.description ??
          (module.status === "generating"
            ? "Materi belajarmu sedang dipersiapkan."
            : "Buka modul untuk melihat detail materi.")}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {module.estimatedMinutes ? (
          <span className={`${badge} ${moduleDurationTone} tabular-nums`}>
            <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
            {module.estimatedMinutes} menit
          </span>
        ) : null}
        <span className={`${badge} ${status.tone}`}>{status.label}</span>
        {module.difficulty ? (
          <span className={`${badge} border-border bg-muted text-muted-foreground`}>
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${moduleDifficulties[module.difficulty].color}`}
            />
            {moduleDifficulties[module.difficulty].label}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        {progress ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <BookOpen aria-hidden="true" className="size-3.5 shrink-0" />
            {progress.completedCoreNodes}/{progress.totalCoreNodes} materi
          </span>
        ) : null}
        <Button asChild size="icon" className="ml-auto size-11 shrink-0">
          <Link
            to={destination}
            aria-label={`${module.status === "ready" || module.status === "archived" ? "Lihat journey" : "Lihat status"}: ${module.title ?? "Modul baru"}`}
            title={
              module.status === "ready" || module.status === "archived"
                ? "Lihat journey"
                : "Lihat status"
            }
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
