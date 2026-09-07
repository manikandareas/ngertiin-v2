import type { AdaptiveIntervention } from "@ngertiin/contracts/api";
import { ArrowRight } from "lucide-react";
import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { nextLearningRoute } from "../next-learning-route";
import { AdaptiveConcepts } from "./adaptive-concepts";
import { AdaptiveLayout } from "./adaptive-layout";
import { AdaptiveStatus } from "./adaptive-status";

const steps = {
  offered: 0,
  generating: 1,
  available: 2,
  in_progress: 2,
  completed: 3,
  failed: 1,
  skipped: null,
} satisfies Record<AdaptiveIntervention["status"], number | null>;

interface AdaptiveInterventionContentProps {
  intervention: AdaptiveIntervention;
  acceptance: { accept: () => Promise<void>; isPending: boolean; error: string | null };
}

export function AdaptiveInterventionContent({
  intervention: data,
  acceptance,
}: AdaptiveInterventionContentProps): JSX.Element {
  const finished = data.status === "completed" || data.status === "skipped";
  const destination = nextLearningRoute(data.nextAction);
  const canStart = Boolean(
    (data.status === "available" || data.status === "in_progress") &&
      destination &&
      data.nodes.some(
        (node) => node.progress.status === "available" || node.progress.status === "in_progress",
      ),
  );
  const coreDestination = nextLearningRoute(data.coreNextAction);
  const coreLabel =
    data.coreNextAction.type === "module_completed" ? "Lihat ringkasan modul" : "Lanjutkan belajar";
  let heading = "Sedikit penguatan, makin paham.";
  let description =
    data.reasonSummary ??
    "Kamu sudah mencoba dengan baik. Yuk, mantapkan beberapa konsep sebelum melangkah lagi.";
  if (data.status === "completed") {
    heading = "Makin paham, siap lanjut!";
    description = "Penguatan selesai. Saatnya melanjutkan perjalanan belajarmu.";
  } else if (data.status === "skipped") {
    heading = "Lanjutkan perjalananmu";
    description = "Penguatan opsional ini sudah dilewati. Kamu bisa melanjutkan belajar.";
  }
  return (
    <AdaptiveLayout moduleId={data.moduleId} step={steps[data.status]}>
      <header className="mb-9 sm:mb-10">
        {!finished ? (
          <span className="mb-3 inline-flex rounded-full bg-adaptive-subtle px-3 py-1 text-xs font-semibold text-adaptive-foreground">
            Penguatan opsional
          </span>
        ) : null}
        <h1
          id="adaptive-heading"
          className="font-display text-2xl font-bold leading-tight tracking-tight"
        >
          {heading}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      <AdaptiveConcepts concepts={data.targetConcepts} />
      <AdaptiveStatus intervention={data} canStart={canStart} />
      <footer className="mt-10 flex flex-col gap-4 border-t border-muted pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant={finished || data.status === "failed" ? "default" : "ghost"}>
          <Link to={coreDestination ?? `/modules/${data.moduleId}/journey`}>
            {coreDestination ? coreLabel : "Kembali ke perjalanan"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        {data.status === "offered" ? (
          <Button disabled={acceptance.isPending} onClick={() => void acceptance.accept()}>
            {acceptance.isPending ? "Menyimpan pilihan…" : "Ambil penguatan"}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : canStart && destination ? (
          <Button asChild>
            <Link to={destination}>
              {data.status === "in_progress" ? "Lanjutkan penguatan" : "Mulai penguatan"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </footer>
      {data.status === "offered" ? (
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Penguatan tidak menambah persentase progres perjalanan utama.
        </p>
      ) : null}
      {acceptance.error ? (
        <p className="mt-5 text-sm text-destructive" role="alert">
          {acceptance.error}
        </p>
      ) : null}
    </AdaptiveLayout>
  );
}
