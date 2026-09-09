import type { AdaptiveIntervention, GenerationPhase } from "@ngertiin/contracts/api";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { JSX } from "react";
import { AdaptiveGenerationRetry } from "./adaptive-generation-retry";

interface AdaptiveStatusProps {
  intervention: AdaptiveIntervention;
  canStart: boolean;
}

const phaseLabels: Partial<Record<GenerationPhase, string>> = {
  understanding_material: "Meninjau konsep yang perlu diperkuat…",
  creating_journey: "Menyusun langkah penguatan…",
  generating_activities: "Menyiapkan materi dan latihan…",
  validating_content: "Memeriksa dan menyimpan materi…",
};

function generationPresentation(generation: AdaptiveIntervention["generation"]): {
  label: string;
  description: string;
} {
  if (generation?.nextRetryAt) {
    return {
      label: "Menunggu percobaan berikutnya…",
      description: "Proses tadi belum berhasil. Kami akan mencoba kembali secara otomatis.",
    };
  }
  let label = "Menyiapkan materi penguatan…";
  if (generation?.state === "queued") {
    label = "Menunggu giliran pembuatan…";
  } else if (generation?.currentPhase) {
    label = phaseLabels[generation.currentPhase] ?? label;
  }
  const description =
    (generation?.attemptNumber ?? 0) > 1
      ? `Mencoba kembali · percobaan ${generation?.attemptNumber} dari ${generation?.maxAttempts ?? 3}. Materi yang sudah valid tetap tersimpan.`
      : "Materi disesuaikan dengan konsep yang perlu kamu perkuat.";
  return { label, description };
}

export function AdaptiveStatus({ intervention: data, canStart }: AdaptiveStatusProps): JSX.Element {
  const finished = data.status === "completed" || data.status === "skipped";
  const progress = data.generation?.progressPercentage ?? 0;
  const generation = data.generation;
  const { label: progressLabel, description: progressDescription } =
    generationPresentation(generation);
  return (
    <>
      {!finished && data.status !== "failed" ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {data.status === "offered"
            ? "Penguatan ini opsional. Kamu bisa memantapkan konsep dulu atau langsung melanjutkan perjalanan."
            : "Penguatan ini tetap opsional. Kamu bisa melanjutkan perjalanan utama kapan saja."}
        </p>
      ) : null}
      {data.status === "generating" ? (
        <section className="mt-6 rounded-xl bg-muted p-6" aria-labelledby="generation-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="generation-heading" className="font-display text-base font-bold">
              {progressLabel}
            </h2>
            <span className="text-sm text-muted-foreground tabular-nums">{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Pembuatan materi penguatan"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-4 h-2 overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-primary motion-safe:transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p role="status" className="mt-3 text-sm leading-6 text-muted-foreground">
            {progressDescription}
          </p>
        </section>
      ) : null}
      {canStart ? (
        <section className="mt-6 rounded-xl bg-muted p-6">
          <h2 className="font-display text-lg font-bold">
            {data.status === "in_progress"
              ? "Lanjut dari langkah terakhirmu"
              : "Materi penguatan siap"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ada {data.nodes.length} langkah terfokus sebelum kembali ke perjalanan utama.
          </p>
        </section>
      ) : null}
      {data.status === "failed" ? (
        <section role="alert" className="mt-6 rounded-xl border border-destructive/30 p-6">
          <TriangleAlert aria-hidden="true" className="mb-3 size-6 text-destructive" />
          <h2 className="font-display text-lg font-bold">Materi belum berhasil dibuat</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Proses belum dapat diselesaikan saat ini. Progres belajarmu tetap tersimpan.
          </p>
          {generation?.failure?.retryable && generation.retriesRemaining > 0 ? (
            <AdaptiveGenerationRetry key={data.id} interventionId={data.id} />
          ) : null}
        </section>
      ) : null}
      {finished ? (
        <CheckCircle2 aria-hidden="true" className="size-8 text-success-foreground" />
      ) : null}
    </>
  );
}
