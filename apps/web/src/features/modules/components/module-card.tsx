import type { ModuleSummary } from "@ngertiin/contracts/api";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { nextLearningRoute } from "../next-learning-route";

const statusLabels: Record<ModuleSummary["status"], string> = {
  generating: "Sedang dibuat",
  ready: "Siap dipelajari",
  failed: "Perlu dicoba lagi",
  archived: "Diarsipkan",
};

export function ModuleCard({ module }: { module: ModuleSummary }) {
  const destination = nextLearningRoute(module.nextAction) ?? `/modules/${module.id}`;
  return (
    <Link
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md"
      to={destination}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            {statusLabels[module.status]}
          </p>
          <h3 className="mt-2 truncate text-lg font-bold">{module.title ?? "Module baru"}</h3>
          {module.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
              {module.description}
            </p>
          ) : null}
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400 transition group-hover:translate-x-1" />
      </div>
      {module.progress ? (
        <div className="mt-5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{module.progress.status.replaceAll("_", " ")}</span>
            <span>{module.progress.percentage}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${module.progress.percentage}%` }}
            />
          </div>
        </div>
      ) : null}
    </Link>
  );
}
