import { ArrowRight, CheckCircle2, CircleDashed, RotateCcw, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import {
  useGeneration,
  useGenerationStream,
  useModule,
  useRetryGeneration,
} from "../features/modules/api/use-modules";
import { ApiProblemError } from "../lib/api";

const phaseLabels = {
  preparing_sources: "Menyiapkan Source",
  understanding_material: "Memahami materi",
  creating_concepts: "Menyusun konsep",
  creating_journey: "Membuat alur belajar",
  generating_activities: "Membuat aktivitas",
  validating_content: "Memvalidasi konten",
} as const;

function retryErrorMessage(error: unknown, isError: boolean): string | null {
  if (error instanceof ApiProblemError) return error.problem.detail;
  return isError ? "Retry belum dapat dikirim. Coba lagi dengan perintah yang sama." : null;
}

export default function ModuleStatusPage() {
  const { moduleId } = useParams();
  const [streamRestart, setStreamRestart] = useState(0);
  const moduleQuery = useModule(moduleId);
  const generationEnabled =
    moduleQuery.data?.status === "generating" || moduleQuery.data?.status === "failed";
  const fallbackPolling = useGenerationStream(moduleId, streamRestart, generationEnabled);
  const generationQuery = useGeneration(moduleId, fallbackPolling, generationEnabled);
  const retryGeneration = useRetryGeneration(moduleId ?? "");
  const [retryKey, setRetryKey] = useState<string | null>(null);
  const generation = generationQuery.data;
  const module = moduleQuery.data;

  async function handleRetry(): Promise<void> {
    const key = retryKey ?? crypto.randomUUID();
    setRetryKey(key);
    try {
      await retryGeneration.mutateAsync(key);
      setRetryKey(null);
      setStreamRestart((current) => current + 1);
      await Promise.allSettled([moduleQuery.refetch(), generationQuery.refetch()]);
    } catch {
      // The mutation keeps the same key and renders a safe API or network error.
    }
  }

  if (moduleQuery.isPending) {
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Memuat status Module…</p>
      </AppShell>
    );
  }

  if (moduleQuery.isError || !module) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8">
          <h1 className="text-2xl font-bold">Module belum dapat dimuat</h1>
          <p className="mt-3 text-slate-600">Periksa koneksi atau akses Module, lalu coba lagi.</p>
          <Button className="mt-6" onClick={() => moduleQuery.refetch()} variant="outline">
            Coba lagi
          </Button>
        </div>
      </AppShell>
    );
  }

  if (module.status === "ready" || module.status === "archived") {
    return <Navigate replace to={`/modules/${module.id}/journey`} />;
  }

  if (generationQuery.isPending) {
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Memuat status Module…</p>
      </AppShell>
    );
  }
  if (generationQuery.isError || !generation) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8">
          <h1 className="text-2xl font-bold">Status generasi belum dapat dimuat</h1>
          <Button className="mt-6" onClick={() => generationQuery.refetch()} variant="outline">
            Coba lagi
          </Button>
        </div>
      </AppShell>
    );
  }

  const retryError = retryErrorMessage(retryGeneration.error, retryGeneration.isError);
  let generationSection: ReactNode;

  if (generation.state === "failed") {
    generationSection = (
      <section className="mt-10 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
        <TriangleAlert aria-hidden="true" className="size-8 text-red-600" />
        <h2 className="mt-5 text-2xl font-bold">Module belum berhasil dibuat</h2>
        <p className="mt-3 text-slate-600">
          {generation.failure?.message ?? "Generasi Module tidak dapat diselesaikan."}
        </p>
        {retryError ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {retryError}
          </p>
        ) : null}
        {generation.failure?.retryable ? (
          <Button className="mt-6 gap-2" disabled={retryGeneration.isPending} onClick={handleRetry}>
            <RotateCcw aria-hidden="true" className="size-4" />
            {retryGeneration.isPending ? "Mengirim retry…" : "Coba buat lagi"}
          </Button>
        ) : null}
      </section>
    );
  } else if (generation.state === "completed") {
    generationSection = (
      <section className="mt-10 rounded-3xl border border-teal-200 bg-white p-8 shadow-sm">
        <CheckCircle2 aria-hidden="true" className="size-9 text-teal-600" />
        <h2 className="mt-5 text-2xl font-bold">Module siap dipelajari</h2>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Tingkat</dt>
            <dd className="mt-1 font-semibold capitalize">{module.difficulty ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Estimasi</dt>
            <dd className="mt-1 font-semibold">
              {module.estimatedMinutes ? `${module.estimatedMinutes} menit` : "—"}
            </dd>
          </div>
        </dl>
        <Button asChild className="mt-7">
          <Link to={`/modules/${module.id}/journey`}>
            {module.nextAction.type === "resume_core_node"
              ? "Lanjutkan Journey"
              : module.nextAction.type === "module_completed"
                ? "Review Journey"
                : "Mulai Journey"}
            <ArrowRight aria-hidden="true" className="ml-2 size-4" />
          </Link>
        </Button>
      </section>
    );
  } else {
    generationSection = (
      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <CircleDashed aria-hidden="true" className="size-7 animate-spin text-teal-600" />
          <div>
            <h2 className="text-xl font-bold">
              {generation.state === "queued" ? "Menunggu giliran" : "Menyusun Module"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {generation.currentPhase
                ? phaseLabels[generation.currentPhase]
                : "Pekerjaan akan segera dimulai."}
            </p>
          </div>
        </div>
        <div className="mt-7 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-600 transition-[width] duration-500"
            style={{ width: `${generation.progressPercentage}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-600">
          {generation.progressPercentage}% selesai
        </p>
        <ol className="mt-8 space-y-3">
          {generation.phases.map((phase) => (
            <li className="flex items-center justify-between text-sm" key={phase.phase}>
              <span>{phaseLabels[phase.phase]}</span>
              <span className="capitalize text-slate-500">{phase.status}</span>
            </li>
          ))}
        </ol>
        {fallbackPolling ? (
          <p className="mt-6 text-xs text-slate-500" role="status">
            Live update terputus; status diperbarui setiap 5 detik.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Module</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          {module.title ?? "Materimu sedang disusun"}
        </h1>
        {module.description ? (
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{module.description}</p>
        ) : null}

        {generationSection}
      </div>
    </AppShell>
  );
}
