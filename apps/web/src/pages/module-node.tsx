import type { AssessmentAnswer } from "@ngertiin/contracts/api";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { type JSX, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  useAttempt,
  useCompleteNode,
  useModule,
  useNode,
  useStartNode,
  useSubmitAttempt,
} from "../features/modules/api/use-modules";
import { AttemptSummary } from "../features/modules/components/attempt-summary";
import { NodeActivity } from "../features/modules/components/node-activity";
import { NodePlayerFooter } from "../features/modules/components/node-player-footer";
import { NodePlayerHeader } from "../features/modules/components/node-player-header";
import { nextLearningRoute } from "../features/modules/next-learning-route";
import { ApiProblemError } from "../lib/api";

function isAnswered(answer: AssessmentAnswer | undefined): boolean {
  return answer !== undefined && (!("text" in answer) || answer.text.trim().length > 0);
}

export default function ModuleNodePage(): JSX.Element {
  const { moduleId = "", nodeId = "" } = useParams();
  return <NodePlayer key={`${moduleId}:${nodeId}`} moduleId={moduleId} nodeId={nodeId} />;
}

interface NodePlayerProps {
  moduleId: string;
  nodeId: string;
}

function NodePlayer({ moduleId, nodeId }: NodePlayerProps): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const attemptId = searchParams.get("attemptId") ?? undefined;
  const moduleQuery = useModule(moduleId);
  const nodeQuery = useNode(moduleId, nodeId);
  const attemptQuery = useAttempt(attemptId, moduleId, nodeId);
  const start = useStartNode(moduleId, nodeId);
  const complete = useCompleteNode(moduleId, nodeId);
  const submit = useSubmitAttempt(moduleId, nodeId);
  const startedNodeId = useRef<string | null>(null);
  const submissionId = useRef<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});

  useEffect(() => {
    if (
      moduleQuery.data?.status !== "ready" ||
      nodeQuery.data?.node.progress.status !== "available" ||
      startedNodeId.current === nodeId
    )
      return;
    startedNodeId.current = nodeId;
    start.mutate();
  }, [moduleQuery.data?.status, nodeId, nodeQuery.data?.node.progress.status, start.mutate]);

  if (nodeQuery.isPending || moduleQuery.isPending)
    return (
      <div
        className="grid min-h-dvh place-items-center bg-background p-6 text-foreground"
        role="status"
      >
        <div className="w-full max-w-xl space-y-6">
          <p>Menyiapkan ruang belajarmu…</p>
          <div className="h-3 rounded-full bg-muted motion-safe:animate-pulse" />
          <div className="h-64 rounded-3xl border-2 border-border bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
    );
  if (nodeQuery.isError || moduleQuery.isError || !nodeQuery.data || !moduleQuery.data)
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <div className="max-w-lg space-y-5">
          <h1 className="text-2xl font-bold">Node belum dapat dibuka</h1>
          <p className="text-muted-foreground">Node mungkin masih terkunci atau tidak tersedia.</p>
          <Button asChild variant="outline">
            <Link to={`/modules/${moduleId}/journey`}>Kembali ke Journey</Link>
          </Button>
        </div>
      </div>
    );

  const data = nodeQuery.data;
  const readOnly = moduleQuery.data.status === "archived";
  const completed = data.node.progress.status === "completed" && !retrying;
  const canComplete =
    !readOnly &&
    data.activities.length > 0 &&
    data.activities.every(
      (activity) => activity.type === "lesson" || activity.type === "flashcard",
    );
  const assessmentActivities = data.activities.filter(
    (activity) =>
      activity.type === "multiple_choice" ||
      activity.type === "true_false" ||
      activity.type === "short_answer",
  );
  const hasAssessments = assessmentActivities.length > 0;
  const allAnswered =
    hasAssessments &&
    assessmentActivities.every((activity) => {
      const answer = answers[activity.id];
      return isAnswered(answer);
    });
  const attemptResult = attemptQuery.data ?? submit.data;
  const mutationError = start.error ?? complete.error ?? submit.error ?? attemptQuery.error;
  let errorMessage: string | null = null;
  if (mutationError instanceof ApiProblemError) {
    errorMessage = mutationError.problem.detail;
  } else if (mutationError) {
    errorMessage = "Progress belum dapat disimpan. Coba lagi.";
  }

  async function handleComplete(): Promise<void> {
    try {
      const result = await complete.mutateAsync();
      navigate(nextLearningRoute(result.nextAction) ?? `/modules/${moduleId}/journey`);
    } catch {
      /* Mutation state renders the safe error. */
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!allAnswered) return;
    submissionId.current ??= attemptResult?.attempt.submissionId ?? crypto.randomUUID();
    try {
      const result = await submit.mutateAsync({
        submissionId: submissionId.current,
        responses: assessmentActivities.map((activity) => ({
          activityId: activity.id,
          answer: answers[activity.id] as AssessmentAnswer,
        })),
      });
      setSearchParams({ attemptId: result.attempt.id }, { replace: true });
      setReviewing(false);
    } catch {
      /* Mutation state renders the safe error and keeps submissionId for retry. */
    }
  }

  function handleTryAgain(): void {
    setRetrying(true);
    submissionId.current = crypto.randomUUID();
    setAnswers({});
    setSlide(0);
    setReviewing(false);
    submit.reset();
    setSearchParams({}, { replace: true });
  }

  const activity = data.activities[slide];
  const showResult = Boolean((attemptResult || attemptId) && !reviewing);
  const locked = readOnly || completed || Boolean(attemptResult || attemptId) || submit.isPending;
  const answer = activity ? answers[activity.id] : undefined;
  const answered = isAnswered(answer);
  const canAdvance =
    locked || !activity || activity.type === "lesson" || activity.type === "flashcard" || answered;
  const lastSlide = slide === data.activities.length - 1;
  function moveTo(index: number): void {
    setSlide(index);
    contentRef.current?.scrollTo({ top: 0 });
    contentRef.current?.focus();
  }

  function renderPrimaryAction(): JSX.Element | null {
    if (!activity) {
      return (
        <Button asChild>
          <Link to={`/modules/${moduleId}/journey`}>Kembali ke Journey</Link>
        </Button>
      );
    }
    if (!lastSlide) {
      return (
        <Button
          className="w-full max-w-sm rounded-full normal-case tracking-normal"
          disabled={!canAdvance}
          onClick={() => moveTo(slide + 1)}
        >
          Lanjutkan
          <ArrowRight />
        </Button>
      );
    }
    if (attemptResult || attemptId) {
      return (
        <Button
          className="w-full max-w-sm rounded-full normal-case tracking-normal"
          onClick={() => setReviewing(false)}
        >
          Lihat hasil
        </Button>
      );
    }
    if (readOnly || completed) {
      return (
        <Button asChild className="w-full max-w-sm rounded-full normal-case tracking-normal">
          <Link to={`/modules/${moduleId}/journey`}>Kembali ke Journey</Link>
        </Button>
      );
    }
    if (hasAssessments) {
      return (
        <Button
          className="w-full max-w-sm rounded-full normal-case tracking-normal"
          disabled={!allAnswered || submit.isPending || start.isPending}
          onClick={handleSubmit}
        >
          {submit.isPending ? "Mengirim…" : "Kirim jawaban"}
          <Check />
        </Button>
      );
    }
    if (canComplete) {
      return (
        <Button
          className="w-full max-w-sm rounded-full normal-case tracking-normal"
          disabled={complete.isPending || start.isPending}
          onClick={handleComplete}
        >
          {complete.isPending ? "Menyimpan…" : "Selesaikan node"}
          <Check />
        </Button>
      );
    }
    return null;
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background px-3 pb-3 pt-1 text-foreground sm:px-6 sm:pb-6 sm:pt-2">
      <NodePlayerHeader
        moduleId={moduleId}
        title={data.node.title}
        activityCount={data.activities.length}
        slide={slide}
        showResult={showResult}
      />
      <main
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-2 ${showResult && attemptResult?.attempt.evaluationStatus === "completed" ? "border-primary" : "border-border"}`}
      >
        <div
          ref={contentRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-8 outline-none sm:px-10 sm:py-12"
        >
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center">
            {showResult ? (
              <div aria-live="polite">
                {attemptResult ? (
                  <AttemptSummary result={attemptResult} />
                ) : (
                  <p role="status">Memuat hasil…</p>
                )}
              </div>
            ) : activity ? (
              <NodeActivity
                key={activity.id}
                activity={activity}
                title={data.node.title}
                readOnly={readOnly}
                completed={completed}
                locked={locked}
                answer={answer}
                onAnswer={(value) =>
                  setAnswers((current) => ({ ...current, [activity.id]: value }))
                }
                result={
                  attemptResult?.attempt.evaluationStatus === "completed"
                    ? attemptResult.attempt.activityResults.find(
                        (item) => item.activityId === activity.id,
                      )
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                <h1 className="text-2xl font-bold">Aktivitas belum tersedia</h1>
                <p className="text-muted-foreground">
                  Kembali ke Journey untuk melihat status node ini.
                </p>
              </div>
            )}
          </div>
        </div>
        <NodePlayerFooter
          errorMessage={errorMessage}
          showResult={showResult}
          reviewing={readOnly || completed}
          activityType={activity?.type}
        >
          {showResult ? (
            <>
              {attemptResult ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewing(true);
                    moveTo(0);
                  }}
                >
                  Tinjau aktivitas
                </Button>
              ) : null}
              {attemptResult?.attempt.evaluationStatus === "completed" && !readOnly ? (
                <Button onClick={handleTryAgain} variant="outline">
                  <RotateCcw />
                  Coba lagi
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button
                aria-label="Aktivitas sebelumnya"
                variant="ghost"
                size="icon"
                disabled={slide === 0}
                onClick={() => moveTo(slide - 1)}
              >
                <ArrowLeft />
              </Button>
              {renderPrimaryAction()}
            </>
          )}
        </NodePlayerFooter>
      </main>
    </div>
  );
}
