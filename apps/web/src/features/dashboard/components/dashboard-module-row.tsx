import { CheckmarkCircle02Icon, CircleIcon, Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dashboard } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";
import { moduleOverviewRoute, nextLearningRoute } from "../../modules/next-learning-route";

import {
  getModuleStatus,
  moduleDifficulties,
  moduleDurationTone,
} from "../../modules/module-presentation";

const badge =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-caption leading-4";
type DashboardModuleRowProps = { module: Dashboard["modules"][number] };

export function DashboardModuleRow({ module }: DashboardModuleRowProps) {
  const progress = module.progress;
  const { label: status, tone } = getModuleStatus(module);
  const difficulty = module.difficulty
    ? moduleDifficulties[module.difficulty]
    : { label: "Belum ditentukan", color: "bg-muted-foreground" };
  const destination = nextLearningRoute(module.nextAction) ?? moduleOverviewRoute(module);
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span
        title={`Tingkat kesulitan: ${difficulty.label}`}
        className="inline-flex size-4 shrink-0 items-center justify-center"
      >
        <span aria-hidden="true" className={`size-2 rounded-full ${difficulty.color}`} />
        <span className="sr-only">Tingkat kesulitan: {difficulty.label}.</span>
      </span>
      <Link
        to={destination}
        className="min-w-0 max-w-full break-words rounded-sm text-sm font-medium hover:text-link hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {module.title ?? "Modul baru"}
      </Link>
      <span className={`${badge} ${tone}`}>
        <HugeiconsIcon
          icon={
            progress?.status === "completed" && module.status === "ready"
              ? CheckmarkCircle02Icon
              : CircleIcon
          }
          size={14}
          strokeWidth={1.5}
          aria-hidden="true"
        />
        {status}
      </span>
      {module.status === "ready" && progress ? (
        <span
          className={`${badge} border-orange-200 bg-orange-50 text-orange-800 dark:border-[#493c35] dark:bg-[#302925] dark:text-[#d8bca9] tabular-nums`}
        >
          {Math.round(progress.percentage)}% selesai
        </span>
      ) : null}
      {module.estimatedMinutes ? (
        <span className={`${badge} ${moduleDurationTone} tabular-nums`}>
          <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={1.5} aria-hidden="true" />
          {module.estimatedMinutes} menit
        </span>
      ) : null}
    </div>
  );
}
