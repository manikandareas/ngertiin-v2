import type { JSX } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  useAdaptiveGenerationStream,
  useAdaptiveIntervention,
} from "../features/modules/api/use-modules";
import { AdaptiveInterventionContent } from "../features/modules/components/adaptive-intervention-content";
import { AdaptiveLayout } from "../features/modules/components/adaptive-layout";
import { useAcceptAdaptiveIntervention } from "../features/modules/use-accept-adaptive-intervention";

export default function AdaptiveInterventionPage(): JSX.Element {
  const { interventionId = "" } = useParams();
  return <AdaptiveIntervention key={interventionId} interventionId={interventionId} />;
}

function AdaptiveIntervention({ interventionId }: { interventionId: string }): JSX.Element {
  const query = useAdaptiveIntervention(interventionId);
  useAdaptiveGenerationStream(interventionId, query.data?.status === "generating");
  const acceptance = useAcceptAdaptiveIntervention(interventionId, query.data?.moduleId);
  if (query.isPending)
    return (
      <AdaptiveLayout step={null}>
        <h1 id="adaptive-heading" className="font-display text-2xl font-bold tracking-tight">
          Memuat penguatanmu…
        </h1>
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Sebentar, kami mengambil informasi belajarmu.
        </p>
        <div aria-hidden="true" className="mt-9 space-y-5 motion-safe:animate-pulse">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-16 rounded-xl bg-muted" />
          <div className="h-16 rounded-xl bg-muted" />
        </div>
      </AdaptiveLayout>
    );
  if (query.isError || !query.data)
    return (
      <AdaptiveLayout step={null} moduleId={query.data?.moduleId}>
        <h1 id="adaptive-heading" className="font-display text-2xl font-bold tracking-tight">
          Penguatan belum tersedia
        </h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-muted-foreground">
          Periksa koneksi atau aksesmu, lalu muat ulang halaman.
        </p>
        <Button
          className="mt-6"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Memuat ulang…" : "Muat ulang"}
        </Button>
      </AdaptiveLayout>
    );
  return <AdaptiveInterventionContent intervention={query.data} acceptance={acceptance} />;
}
