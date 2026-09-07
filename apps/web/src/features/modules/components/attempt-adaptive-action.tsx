import type { AdaptiveIntervention, NextLearningAction } from "@ngertiin/contracts/api";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { ApiProblemError } from "../../../lib/api";
import {
  useAdaptiveDecision,
  useAdaptiveGenerationStream,
  useAdaptiveIntervention,
  useNode,
} from "../api/use-modules";
import { nextLearningRoute } from "../next-learning-route";
import { AdaptiveGuidance } from "./adaptive-guidance";

const actionLabels = {
  offered: "Lihat pilihan penguatan",
  generating: "Lihat progres pembuatan",
  failed: "Lihat status penguatan",
  available: "Mulai penguatan",
  in_progress: "Lanjutkan penguatan",
  completed: "Lanjutkan belajar",
  skipped: "Lanjutkan belajar",
} satisfies Record<AdaptiveIntervention["status"], string>;

export function AttemptAdaptiveAction({ action }: { action: NextLearningAction }) {
  const navigate = useNavigate();
  const nodeAction =
    action.type === "start_adaptive_node" || action.type === "resume_adaptive_node"
      ? action
      : undefined;
  const node = useNode(nodeAction?.moduleId, nodeAction?.nodeId);
  const interventionId =
    "interventionId" in action ? action.interventionId : node.data?.node.interventionId;
  const intervention = useAdaptiveIntervention(interventionId);
  const data = intervention.data;
  useAdaptiveGenerationStream(interventionId, data?.status === "generating");
  const decision = useAdaptiveDecision(interventionId ?? "", data?.moduleId);
  const destination = nextLearningRoute(data?.nextAction ?? action);
  const offered = data?.status === "offered";
  const finished = data?.status === "completed" || data?.status === "skipped";
  let detailMessage = "Memuat detail penguatan…";
  if (node.isError || intervention.isError) {
    detailMessage = "Detail penguatan belum dapat dimuat. Buka penguatan untuk melihat statusnya.";
  } else if (finished) {
    detailMessage =
      "Penguatan ini sudah selesai atau dilewati. Kamu bisa melanjutkan perjalanan belajar.";
  }
  const error =
    decision.error instanceof ApiProblemError
      ? decision.error.problem.detail
      : decision.error
        ? "Pilihanmu belum tersimpan. Coba lagi."
        : null;

  async function decide(value: "accept" | "decline") {
    try {
      const updated = await decision.mutateAsync({ decision: value, key: crypto.randomUUID() });
      const route = nextLearningRoute(updated.nextAction);
      if (route) navigate(route);
    } catch {
      // The mutation error is shown below; keep the choice available for retry.
    }
  }

  return (
    <section
      className="space-y-4 rounded-card bg-adaptive-subtle p-5 text-adaptive-foreground"
      aria-label="Langkah penguatan"
    >
      <div className="space-y-2" aria-live="polite">
        {data && !finished ? (
          <AdaptiveGuidance intervention={data} />
        ) : (
          <>
            <h3 className="font-bold">Latihan penguatan</h3>
            <p className="text-sm leading-6">{detailMessage}</p>
          </>
        )}
        {data?.status === "generating" ? (
          <p className="text-sm leading-6">
            Materi sedang dibuat. Halaman berikutnya menampilkan progres pembuatannya.
          </p>
        ) : null}
        {data?.status === "failed" ? (
          <p className="text-sm leading-6">
            Materi belum berhasil dibuat. Buka status penguatan untuk melihat kondisinya.
          </p>
        ) : null}
      </div>
      {offered ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="normal-case tracking-normal"
            disabled={decision.isPending}
            onClick={() => void decide("accept")}
          >
            {decision.isPending ? "Menyimpan pilihan…" : "Ambil penguatan"}
          </Button>
          <Button
            variant="outline"
            className="normal-case tracking-normal"
            disabled={decision.isPending}
            onClick={() => void decide("decline")}
          >
            Lewati dan lanjut
          </Button>
        </div>
      ) : destination ? (
        <Button
          asChild
          className="h-auto min-h-12 w-full whitespace-normal py-3 normal-case tracking-normal"
        >
          <Link to={destination}>{data ? actionLabels[data.status] : "Lihat penguatan"}</Link>
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
