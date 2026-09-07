import {
  AlertCircleIcon,
  ArrowRight01Icon,
  Clock01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AttemptResult } from "@ngertiin/contracts/api";
import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { nextLearningRoute } from "../next-learning-route";
import { AttemptAdaptiveAction } from "./attempt-adaptive-action";
import { AttemptAnswerReview } from "./attempt-answer-review";

interface AttemptSummaryProps {
  result: AttemptResult;
}

const nextActionLabels = {
  wait_for_module: "Lihat modul",
  retry_module: "Lihat modul",
  start_core_node: "Lanjutkan belajar",
  resume_core_node: "Lanjutkan belajar",
  start_adaptive_node: null,
  resume_adaptive_node: null,
  offer_optional_review: null,
  wait_for_adaptive: null,
  module_completed: "Lihat perjalanan belajar",
  none: null,
} satisfies Record<AttemptResult["nextAction"]["type"], string | null>;

export function AttemptSummary({ result }: AttemptSummaryProps): JSX.Element {
  const { attempt } = result;
  if (attempt.evaluationStatus === "evaluating") {
    return (
      <section className="space-y-5" role="status">
        <HugeiconsIcon
          icon={Clock01Icon}
          strokeWidth={1.5}
          aria-hidden="true"
          className="size-10 rounded-xl bg-accent p-2 text-accent-foreground"
        />
        <h2 className="text-2xl font-bold">Jawabanmu sedang dievaluasi.</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Hasil akan tersedia setelah evaluasi selesai.
        </p>
        <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
          <div className="h-3 rounded-full bg-muted" />
          <div className="h-3 w-4/5 rounded-full bg-muted" />
          <div className="h-3 w-3/5 rounded-full bg-muted" />
        </div>
      </section>
    );
  }
  if (attempt.evaluationStatus === "failed") {
    return (
      <section className="space-y-4 rounded-card bg-destructive/10 p-5" role="status">
        <HugeiconsIcon
          icon={AlertCircleIcon}
          strokeWidth={1.5}
          aria-hidden="true"
          className="size-6 text-destructive"
        />
        <h2 className="text-xl font-bold text-destructive">Evaluasi belum berhasil</h2>
        <p className="text-sm leading-7 text-destructive">{attempt.failure.message}</p>
        <p className="text-sm leading-7 text-foreground">
          {attempt.failure.retryable
            ? "Jawabanmu sudah tersimpan. Buka kembali halaman ini beberapa saat lagi."
            : "Jawabanmu tetap tersimpan, tetapi hasil belajar belum diperbarui."}
        </p>
      </section>
    );
  }

  const percentage = Math.round(attempt.normalizedScore * 100);
  const destination = nextLearningRoute(result.nextAction);
  const nextAction = nextActionLabels[result.nextAction.type];
  const feedback = attempt.feedback;

  return (
    <section className="space-y-8 text-foreground" aria-label="Hasil assessment">
      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-link">Hasil assessment</p>
        <h2 className="text-3xl font-bold">Assessment selesai.</h2>
      </header>

      <div className="flex items-center gap-5 rounded-card bg-accent p-5 sm:gap-7 sm:p-6">
        <div className="relative grid size-24 shrink-0 place-items-center sm:size-28">
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            className="absolute inset-0 size-full -rotate-90 fill-none stroke-7"
          >
            <circle cx="60" cy="60" r="51" className="stroke-accent-foreground/15" />
            <circle
              cx="60"
              cy="60"
              r="51"
              pathLength="100"
              strokeDasharray={`${attempt.normalizedScore * 100} 100`}
              strokeLinecap="round"
              className="stroke-primary"
            />
          </svg>
          <p className="font-display text-3xl font-extrabold tabular-nums text-accent-foreground">
            <span className="sr-only">Skor </span>
            {percentage}
            <span className="text-sm">%</span>
          </p>
        </div>
        <div className="min-w-0 space-y-2">
          <h3 className="text-lg font-bold text-accent-foreground">Hasil belajarmu.</h3>
          <p className="text-sm text-accent-foreground">
            {attempt.score} dari {attempt.maxScore} poin tercapai
          </p>
          <p className="text-sm font-bold text-success-foreground">
            +{result.xpAwarded} XP diperoleh
          </p>
        </div>
      </div>

      {feedback ? (
        <section className="space-y-6" aria-label="Feedback">
          <p className="text-sm leading-7 text-muted-foreground">{feedback.summary}</p>
          {feedback.strengths.length || feedback.areasToImprove.length ? (
            <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
              {feedback.strengths.length ? (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-success-foreground">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    Yang sudah kuat
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
                    {feedback.strengths.map((strength) => (
                      <li key={strength}>{strength}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {feedback.areasToImprove.length ? (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    Yang perlu dilatih
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
                    {feedback.areasToImprove.map((area) => (
                      <li key={area}>{area}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <AttemptAnswerReview activities={attempt.activityResults} />

      {attempt.conceptResults.length ? (
        <section className="space-y-3" aria-label="Konsep yang dinilai">
          <h3 className="font-bold">Konsep yang dinilai</h3>
          <div className="flex flex-wrap gap-2">
            {attempt.conceptResults.map((concept) => (
              <Badge
                variant="outline"
                className="max-w-full whitespace-normal break-words font-semibold"
                key={concept.conceptKey}
              >
                {concept.conceptKey.replaceAll("_", " ")}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {[
        "offer_optional_review",
        "wait_for_adaptive",
        "start_adaptive_node",
        "resume_adaptive_node",
      ].includes(result.nextAction.type) ? (
        <AttemptAdaptiveAction action={result.nextAction} />
      ) : destination && nextAction ? (
        <footer className="border-t border-border pt-6">
          <Button
            asChild
            className="h-auto min-h-12 w-full max-w-full whitespace-normal px-6 py-3 text-center normal-case tracking-normal"
          >
            <Link to={destination}>
              {nextAction}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={1.5}
                aria-hidden="true"
                className="shrink-0"
              />
            </Link>
          </Button>
        </footer>
      ) : null}
    </section>
  );
}
