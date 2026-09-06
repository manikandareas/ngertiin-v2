import { CheckmarkCircle02Icon, CircleIcon, Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dashboard } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";
import { moduleOverviewRoute, nextLearningRoute } from "../../modules/next-learning-route";

const badge =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-caption leading-4";
const statusTones = {
  neutral: "border-border bg-muted text-muted-foreground",
  active:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-[#494136] dark:bg-[#302c26] dark:text-[#d7c4a4]",
  failed:
    "border-destructive/20 bg-destructive/5 text-destructive dark:border-[#4b3838] dark:bg-[#302626] dark:text-[#d7b7b5]",
  completed:
    "border-success/30 bg-success-subtle text-success-foreground dark:border-[#3b4740] dark:bg-[#27302b] dark:text-[#b9cdbf]",
};
const difficulties = {
  beginner: { label: "Pemula", color: "bg-primary" },
  intermediate: { label: "Menengah", color: "bg-orange-500" },
  advanced: { label: "Lanjutan", color: "bg-red-500" },
};
type DashboardModuleRowProps = { module: Dashboard["modules"][number] };

function getModuleStatus(module: DashboardModuleRowProps["module"]): {
  label: string;
  tone: string;
} {
  switch (module.status) {
    case "generating":
      return { label: "Sedang disiapkan", tone: statusTones.active };
    case "failed":
      return { label: "Perlu dicoba lagi", tone: statusTones.failed };
    case "archived":
      return { label: "Diarsipkan", tone: statusTones.neutral };
    case "ready":
      switch (module.progress?.status) {
        case "completed":
          return { label: "Selesai", tone: statusTones.completed };
        case "in_progress":
          return { label: "Sedang dipelajari", tone: statusTones.active };
        default:
          return { label: "Belum dimulai", tone: statusTones.neutral };
      }
  }
}

export function DashboardModuleRow({ module }: DashboardModuleRowProps) {
  const progress = module.progress;
  const { label: status, tone } = getModuleStatus(module);
  const difficulty = module.difficulty
    ? difficulties[module.difficulty]
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
        <span
          className={`${badge} border-lime-200 bg-lime-50 text-lime-800 dark:border-[#3e4539] dark:bg-[#292e27] dark:text-[#c4cdb3] tabular-nums`}
        >
          <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={1.5} aria-hidden="true" />
          {module.estimatedMinutes} menit
        </span>
      ) : null}
    </div>
  );
}
