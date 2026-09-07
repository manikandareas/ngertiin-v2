import {
  ArrowUpRight01Icon,
  BookOpen01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dashboard } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";
import { getModuleStatus, moduleDifficulties } from "../../modules/module-presentation";
import { moduleOverviewRoute, nextLearningRoute } from "../../modules/next-learning-route";

export function DashboardModuleFolder({ module }: { module: Dashboard["modules"][number] }) {
  const progress = module.status === "ready" ? module.progress : null;
  const completed = progress?.status === "completed";
  const { label: status } = getModuleStatus(module);

  return (
    <article className="before:absolute before:-top-[11px] before:-left-0.5 before:h-[11px] before:w-21 before:rounded-t-[10px_14px] before:border-2 before:border-border before:border-b-0 before:bg-card before:content-[''] motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:hover:-translate-y-[3px] motion-safe:hover:rotate-[0.4deg] relative flex h-full min-w-0 flex-col rounded-card rounded-tl-none border-2 bg-card px-5 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-caption text-muted-foreground">
        <span>
          {module.difficulty ? moduleDifficulties[module.difficulty].label : "Belum ditentukan"}
        </span>
        <HugeiconsIcon
          icon={completed ? CheckmarkCircle02Icon : BookOpen01Icon}
          size={18}
          strokeWidth={1.5}
          aria-hidden="true"
          className={completed ? "text-success-foreground" : "text-link"}
        />
      </div>
      <h3 className="break-words font-display text-base font-bold leading-snug">
        <Link
          to={moduleOverviewRoute(module)}
          className="rounded-sm underline-offset-4 hover:text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {module.title ?? "Modul baru"}
        </Link>
      </h3>
      <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
        <span className={module.status === "failed" ? "text-destructive" : undefined}>
          {status}
        </span>
        {module.estimatedMinutes ? ` · ${module.estimatedMinutes} menit` : null}
      </p>
      <div className="mt-auto flex items-center gap-3 pt-5">
        {progress ? (
          <>
            <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
              {Math.round(progress.percentage)}% selesai
            </span>
            <progress
              className="learning-progress min-w-0 flex-1"
              aria-label={`Kemajuan ${module.title ?? "modul baru"}`}
              value={progress.percentage}
              max={100}
            />
          </>
        ) : (
          <span className="text-caption font-semibold text-link">Buka modul</span>
        )}
        <Link
          to={nextLearningRoute(module.nextAction) ?? moduleOverviewRoute(module)}
          aria-label={`Buka ${module.title ?? "modul baru"}`}
          className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-link hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
