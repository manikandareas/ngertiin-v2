import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { useAdaptiveGenerationStream, useAdaptiveIntervention } from "../api/use-modules";
import { nextLearningRoute } from "../next-learning-route";
import { useAcceptAdaptiveIntervention } from "../use-accept-adaptive-intervention";

interface AttemptAdaptiveActionProps {
  interventionId: string;
}

export function AttemptAdaptiveAction({
  interventionId,
}: AttemptAdaptiveActionProps): JSX.Element | null {
  const intervention = useAdaptiveIntervention(interventionId);
  const data = intervention.data;
  useAdaptiveGenerationStream(interventionId, data?.status === "generating");
  const acceptance = useAcceptAdaptiveIntervention(interventionId, data?.moduleId);
  const page = `/adaptive-interventions/${interventionId}`;

  if (data?.status === "completed" || data?.status === "skipped") return null;
  const title = data?.targetConcepts.length
    ? `Mantapkan ${data.targetConcepts.map((concept) => concept.name).join(", ")}`
    : "Mantapkan konsep yang masih perlu dilatih";
  const destination =
    data && (data.status === "available" || data.status === "in_progress")
      ? (nextLearningRoute(data.nextAction) ?? page)
      : page;
  let description =
    "Kamu bisa mengambil penguatan singkat untuk konsep ini. Perjalanan utama tetap bisa dilanjutkan.";
  if (intervention.isError)
    description = "Detail penguatan belum dapat dimuat. Kamu tetap bisa melanjutkan belajar.";
  else if (!data) description = "Memuat rekomendasi penguatan…";
  else if (data.status === "generating")
    description =
      "Materi penguatan sedang disiapkan. Kamu tetap bisa melanjutkan perjalanan utama.";
  else if (data.status === "failed")
    description =
      "Materi belum berhasil dibuat. Progresmu tetap tersimpan dan perjalanan utama bisa dilanjutkan.";
  let actionLabel = "Lihat status penguatan";
  if (data?.status === "available") actionLabel = "Mulai penguatan";
  else if (data?.status === "in_progress") actionLabel = "Lanjutkan penguatan";
  return (
    <aside
      className="space-y-3 rounded-xl bg-adaptive-subtle p-5 text-adaptive-foreground sm:p-6"
      aria-label="Rekomendasi penguatan"
    >
      <span className="inline-flex rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-adaptive-foreground">
        Opsional
      </span>
      <h3 className="break-words font-display text-base font-bold">{title}</h3>
      <p className="text-sm leading-6">{description}</p>
      {data?.status === "offered" ? (
        <Button
          variant="link"
          className="h-auto min-h-10 max-w-full whitespace-normal px-0 text-left text-adaptive-foreground"
          disabled={acceptance.isPending}
          onClick={() => void acceptance.accept()}
        >
          {acceptance.isPending ? "Menyiapkan penguatan…" : "Ambil penguatan"}
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden="true" />
        </Button>
      ) : data || intervention.isError ? (
        <Button
          asChild
          variant="link"
          className="h-auto min-h-10 max-w-full whitespace-normal px-0 text-adaptive-foreground"
        >
          <Link to={destination}>
            {actionLabel}
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
      {acceptance.error ? (
        <p role="alert" className="text-sm text-destructive">
          {acceptance.error}
        </p>
      ) : null}
    </aside>
  );
}
