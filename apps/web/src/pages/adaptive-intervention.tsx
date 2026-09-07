import { ArrowRight, CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import {
  useAdaptiveDecision,
  useAdaptiveGenerationStream,
  useAdaptiveIntervention,
} from "../features/modules/api/use-modules";
import { ApiProblemError } from "../lib/api";
import { AdaptiveGuidance } from "../features/modules/components/adaptive-guidance";
import { nextLearningRoute } from "../features/modules/next-learning-route";

export default function AdaptiveInterventionPage() {
  const { interventionId = "" } = useParams();
  const navigate = useNavigate();
  const query = useAdaptiveIntervention(interventionId);
  useAdaptiveGenerationStream(interventionId, query.data?.status === "generating");
  const decision = useAdaptiveDecision(interventionId, query.data?.moduleId);
  if (query.isPending)
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Memuat dukungan belajar…</p>
      </AppShell>
    );
  if (query.isError || !query.data)
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8">
          <h1 className="text-2xl font-bold">Intervention tidak tersedia</h1>
          <p className="mt-3 text-slate-600">Periksa akses atau muat ulang halaman.</p>
        </div>
      </AppShell>
    );
  const data = query.data;
  const error =
    decision.error instanceof ApiProblemError
      ? decision.error.problem.detail
      : decision.error
        ? "Keputusan belum dapat disimpan."
        : null;
  const decide = async (value: "accept" | "decline") => {
    try {
      const updated = await decision.mutateAsync({ decision: value, key: crypto.randomUUID() });
      const destination = nextLearningRoute(updated.nextAction);
      if (destination) navigate(destination);
    } catch {
      /* rendered below */
    }
  };
  const learningNode =
    data.nodes.find((node) => node.progress.status === "in_progress") ??
    data.nodes.find((node) => node.progress.status === "available");
  const destination = nextLearningRoute(data.nextAction);
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Adaptive learning
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Dukungan yang disesuaikan untukmu
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          {data.reasonSummary ?? "Kami menyiapkan penguatan singkat berdasarkan hasil belajarmu."}
        </p>
        {data.status !== "completed" && data.status !== "skipped" ? (
          <div className="mt-4 text-foreground">
            <AdaptiveGuidance intervention={data} />
          </div>
        ) : null}
        {data.targetConcepts.length ? (
          <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold">Konsep yang diperkuat</h2>
            <ul className="mt-3 space-y-2">
              {data.targetConcepts.map((concept) => (
                <li
                  className="flex justify-between rounded-xl bg-slate-50 px-4 py-3"
                  key={concept.key}
                >
                  <span>{concept.name}</span>
                  <span className="text-sm text-slate-500">
                    {Math.round(concept.masteryScore * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {data.status === "offered" ? (
          <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">Mau penguatan singkat dulu?</h2>
            <p className="mt-2 text-slate-700">
              Penguatan ini opsional dan tidak menambah persentase progres perjalanan utama.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button disabled={decision.isPending} onClick={() => void decide("accept")}>
                Ambil penguatan
              </Button>
              <Button
                disabled={decision.isPending}
                onClick={() => void decide("decline")}
                variant="outline"
              >
                Lewati dan lanjut
              </Button>
            </div>
          </section>
        ) : null}
        {data.status === "generating" ? (
          <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-7 text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-teal-600" />
            <h2 className="mt-4 text-xl font-bold">Menyiapkan materi penguatan…</h2>
            <p className="mt-2 text-slate-600">
              {data.generation?.progressPercentage ?? 0}% selesai
            </p>
          </section>
        ) : null}
        {(data.status === "available" || data.status === "in_progress") &&
        learningNode &&
        destination ? (
          <section className="mt-7 rounded-3xl border border-teal-200 bg-white p-7">
            <h2 className="text-xl font-bold">Materi penguatan siap</h2>
            <p className="mt-2 text-slate-600">
              Ada {data.nodes.length} langkah terfokus sebelum kembali ke perjalanan utama.
            </p>
            <Button asChild className="mt-5">
              <Link to={destination}>
                {data.status === "in_progress" ? "Lanjutkan penguatan" : "Mulai penguatan"}
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </section>
        ) : null}
        {data.status === "failed" ? (
          <section className="mt-7 rounded-3xl border border-red-200 bg-red-50 p-7 text-red-900">
            <TriangleAlert className="size-7" />
            <h2 className="mt-3 text-xl font-bold">Materi belum berhasil dibuat</h2>
            <p className="mt-2">
              Proses tidak dapat diselesaikan saat ini. Progress-mu tetap aman.
            </p>
          </section>
        ) : null}
        {data.status === "completed" || data.status === "skipped" ? (
          <section className="mt-7 rounded-3xl border border-teal-200 bg-teal-50 p-7">
            <CheckCircle2 className="size-7 text-teal-700" />
            <h2 className="mt-3 text-xl font-bold">
              {data.status === "completed" ? "Penguatan selesai" : "Review dilewati"}
            </h2>
            <Button asChild className="mt-5">
              <Link to={destination ?? `/modules/${data.moduleId}/journey`}>
                Kembali ke Core Journey
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </section>
        ) : null}
        {error ? (
          <p className="mt-5 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    </AppShell>
  );
}
