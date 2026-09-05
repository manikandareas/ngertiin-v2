import type { AttemptResult } from "@ngertiin/contracts/api";
import { ArrowRight } from "lucide-react";
import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { nextLearningRoute } from "../next-learning-route";

interface AttemptSummaryProps {
  result: AttemptResult;
}

export function AttemptSummary({ result }: AttemptSummaryProps): JSX.Element {
  const { attempt } = result;
  if (attempt.evaluationStatus === "evaluating") {
    return <p className="mt-8 rounded-2xl bg-muted p-5">Jawaban sedang dievaluasi…</p>;
  }
  if (attempt.evaluationStatus === "failed") {
    return (
      <div className="mt-8 rounded-2xl bg-destructive/10 p-5 text-destructive">
        <p className="font-semibold">Evaluasi belum berhasil</p>
        <p className="mt-2">{attempt.failure.message}</p>
        <p className="mt-2 text-sm">
          {attempt.failure.retryable
            ? "Jawabanmu sudah tersimpan. Buka kembali halaman ini beberapa saat lagi."
            : "Jawabanmu tetap tersimpan, tetapi hasil belajar belum diperbarui."}
        </p>
      </div>
    );
  }
  const destination = nextLearningRoute(result.nextAction);
  return (
    <section className="mt-8 rounded-3xl border border-border bg-background p-7 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Hasil assessment
      </p>
      <p className="mt-3 text-3xl font-bold">
        {attempt.score} / {attempt.maxScore}
      </p>
      <p className="mt-1 text-muted-foreground">
        Skor {Math.round((attempt.normalizedScore ?? 0) * 100)}% · +{result.xpAwarded} XP
      </p>
      {attempt.feedback ? (
        <div className="mt-6 space-y-5 rounded-2xl bg-muted p-5 text-foreground">
          <div>
            <h2 className="font-bold">Feedback</h2>
            <p className="mt-2 leading-7">{attempt.feedback.summary}</p>
          </div>
          {attempt.feedback.strengths.length ? (
            <div>
              <h3 className="font-semibold">Yang sudah kuat</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {attempt.feedback.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {attempt.feedback.areasToImprove.length ? (
            <div>
              <h3 className="font-semibold">Yang bisa ditingkatkan</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {attempt.feedback.areasToImprove.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {attempt.conceptResults.length ? (
        <div className="mt-6 space-y-3">
          <h2 className="font-bold">Penguasaan konsep</h2>
          {attempt.conceptResults.map((concept) => (
            <div className="rounded-xl bg-muted p-4" key={concept.conceptKey}>
              <p className="font-semibold">{concept.conceptKey.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Performa {Math.round(concept.performanceScore * 100)}% · Mastery{" "}
                {Math.round(concept.masteryScore * 100)}% · Confidence{" "}
                {Math.round(concept.confidenceScore * 100)}% · {concept.evidenceCount} evidence
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-5 text-sm text-muted-foreground">
        Langkah berikutnya: {result.nextAction.type.replaceAll("_", " ")}
      </p>
      {destination ? (
        <Button asChild className="mt-5">
          <Link to={destination}>
            Lanjutkan belajar
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}
