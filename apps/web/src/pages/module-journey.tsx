import { ArrowRight, Check, Circle, LockKeyhole } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { useJourney } from "../features/modules/api/use-modules";

const statusLabel = {
  locked: "Terkunci",
  available: "Siap dimulai",
  in_progress: "Sedang dipelajari",
  completed: "Selesai",
} as const;

export default function ModuleJourneyPage() {
  const { moduleId } = useParams();
  const journey = useJourney(moduleId);

  if (journey.isPending) {
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Memuat Journey…</p>
      </AppShell>
    );
  }
  if (journey.isError || !journey.data) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8">
          <h1 className="text-2xl font-bold">Journey belum dapat dimuat</h1>
          <p className="mt-3 text-slate-600">Periksa akses Module atau coba muat ulang halaman.</p>
        </div>
      </AppShell>
    );
  }

  const data = journey.data;
  const selectedNodeId =
    data.nextAction.type === "start_core_node" ||
    data.nextAction.type === "resume_core_node" ||
    data.nextAction.type === "start_adaptive_node" ||
    data.nextAction.type === "resume_adaptive_node"
      ? data.nextAction.nodeId
      : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Journey</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{data.module.title}</h1>
        {data.module.description ? (
          <p className="mt-4 text-lg leading-8 text-slate-600">{data.module.description}</p>
        ) : null}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Progress Core</p>
              <p className="mt-1 text-2xl font-bold">{data.progress.percentage}%</p>
            </div>
            <p className="text-sm font-medium text-slate-600">
              {data.progress.completedCoreNodes} dari {data.progress.totalCoreNodes} node
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${data.progress.percentage}%` }}
            />
          </div>
          {selectedNodeId ? (
            <Button asChild className="mt-6 w-full sm:w-auto">
              <Link to={`/modules/${data.module.id}/nodes/${selectedNodeId}`}>
                {data.nextAction.type === "resume_core_node" ||
                data.nextAction.type === "resume_adaptive_node"
                  ? "Lanjutkan belajar"
                  : "Mulai belajar"}
                <ArrowRight aria-hidden="true" className="ml-2 size-4" />
              </Link>
            </Button>
          ) : data.nextAction.type === "module_completed" ? (
            <p className="mt-6 rounded-2xl bg-teal-50 p-4 font-medium text-teal-800">
              Semua Core Node sudah selesai.
            </p>
          ) : data.nextAction.type === "offer_optional_review" ||
            data.nextAction.type === "wait_for_adaptive" ? (
            <Button asChild className="mt-6 w-full sm:w-auto">
              <Link to={`/adaptive-interventions/${data.nextAction.interventionId}`}>
                Buka dukungan belajar
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          ) : null}
        </section>

        <ol className="mt-8 space-y-3">
          {data.nodes.map((node) => {
            const content = (
              <div
                className={`flex items-center gap-4 rounded-2xl border bg-white p-5 ${node.origin === "adaptive" ? "ml-6 border-teal-200" : "border-slate-200"}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100">
                  {node.progress.status === "locked" ? (
                    <LockKeyhole className="size-4" />
                  ) : node.progress.status === "completed" ? (
                    <Check className="size-5 text-teal-700" />
                  ) : (
                    <Circle className="size-4 text-teal-700" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {node.origin === "adaptive" ? "Adaptive" : node.position}. {node.type}
                  </p>
                  <h2 className="mt-1 font-bold">{node.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{statusLabel[node.progress.status]}</p>
                </div>
                {node.progress.status !== "locked" ? (
                  <ArrowRight className="size-4 text-slate-400" />
                ) : null}
              </div>
            );
            return (
              <li key={node.id}>
                {node.progress.status === "locked" ? (
                  content
                ) : (
                  <Link to={`/modules/${data.module.id}/nodes/${node.id}`}>{content}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </AppShell>
  );
}
