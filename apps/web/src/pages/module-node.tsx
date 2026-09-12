import { ArrowLeft01Icon, ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AssessmentAnswer } from "@ngertiin/contracts/api";
import { type JSX, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ChatSidebar } from "../features/chat/components/chat-sidebar";
import {
  useAttempt,
  useCompleteNode,
  useModule,
  useNode,
  useStartNode,
  useSubmitAttempt,
} from "../features/modules/api/use-modules";
import { getAttemptPresentation } from "../features/modules/attempt-presentation";
import { NodeActivity } from "../features/modules/components/node-activity";
import { NodeAttemptResult } from "../features/modules/components/node-attempt-result";
import { NodePlayerFooter } from "../features/modules/components/node-player-footer";
import { NodePlayerLayout } from "../features/modules/components/node-player-layout";
import { useAttemptEffects } from "../features/modules/hooks/use-attempt-effects";
import { nextLearningRoute } from "../features/modules/next-learning-route";
import { ApiProblemError } from "../lib/api";

const primaryActionClassName = "max-w-full rounded-full px-6 normal-case tracking-normal";

// Reset hook state during development updates, including changes to imported hooks.
// @refresh reset

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
  const [retrying, setRetrying] = useState(false);
  const moduleQuery = useModule(moduleId);
  const nodeQuery = useNode(moduleId, nodeId);
  const attemptId =
    searchParams.get("attemptId") ??
    (!retrying ? nodeQuery.data?.latestCompletedAttemptId : undefined) ??
    undefined;
  const attemptQuery = useAttempt(attemptId, moduleId, nodeId);
  const start = useStartNode(moduleId, nodeId);
  const complete = useCompleteNode(moduleId, nodeId);
  const submit = useSubmitAttempt(moduleId, nodeId);
  const startedNodeId = useRef<string | null>(null);
  const submissionId = useRef<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [reviewing, setReviewing] = useState(false);
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

  const attemptResult = attemptQuery.data ?? submit.data;
  const showResult = Boolean((attemptResult || attemptId) && !reviewing);
  const resultEffects = useAttemptEffects(attemptResult, showResult);
  const resultTone =
    showResult && attemptResult?.attempt.evaluationStatus === "completed"
      ? getAttemptPresentation(attemptResult.attempt.normalizedScore).tone
      : undefined;

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
  const mutationError = start.error ?? complete.error ?? submit.error;
  let errorMessage: string | null = null;
  if (mutationError instanceof ApiProblemError) {
    errorMessage = mutationError.problem.detail;
  } else if (mutationError) {
    errorMessage = "Progress belum dapat disimpan. Coba lagi.";
  }

  function resetContentPosition(): void {
    contentRef.current?.scrollIntoView({ block: "start" });
    requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }));
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
    resultEffects.prepareSubmission();
    submissionId.current ??= attemptResult?.attempt.submissionId ?? crypto.randomUUID();
    try {
      const result = await submit.mutateAsync({
        submissionId: submissionId.current,
        responses: assessmentActivities.map((activity) => ({
          activityId: activity.id,
          answer: answers[activity.id] as AssessmentAnswer,
        })),
      });
      resultEffects.markSubmitted(result.attempt.id);
      setSearchParams({ attemptId: result.attempt.id }, { replace: true });
      setReviewing(false);
      setRetrying(false);
      resetContentPosition();
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
    resetContentPosition();
  }

  const activity = data.activities[slide];
  const locked = readOnly || completed || Boolean(attemptResult || attemptId) || submit.isPending;
  const activityResult =
    activity && attemptResult?.attempt.evaluationStatus === "completed"
      ? attemptResult.attempt.activityResults.find((item) => item.activityId === activity.id)
      : undefined;
  const answer = activityResult?.answer ?? (activity ? answers[activity.id] : undefined);
  const answered = isAnswered(answer);
  const canAdvance =
    locked || !activity || activity.type === "lesson" || activity.type === "flashcard" || answered;
  const lastSlide = slide === data.activities.length - 1;
  function moveTo(index: number): void {
    setSlide(index);
    resetContentPosition();
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
          className={primaryActionClassName}
          disabled={!canAdvance}
          onClick={() => moveTo(slide + 1)}
        >
          Lanjutkan
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      );
    }
    if (attemptResult || attemptId) {
      return (
        <Button
          className={primaryActionClassName}
          onClick={() => {
            setReviewing(false);
            resetContentPosition();
          }}
        >
          Lihat hasil
        </Button>
      );
    }
    if (readOnly || completed) {
      return (
        <Button asChild className={primaryActionClassName}>
          <Link to={`/modules/${moduleId}/journey`}>Kembali ke Journey</Link>
        </Button>
      );
    }
    if (hasAssessments) {
      return (
        <Button
          className={primaryActionClassName}
          disabled={!allAnswered || submit.isPending || start.isPending}
          onClick={handleSubmit}
        >
          {submit.isPending ? "Mengirim…" : "Kirim jawaban"}
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      );
    }
    if (canComplete) {
      return (
        <Button
          className={primaryActionClassName}
          disabled={complete.isPending || start.isPending}
          onClick={handleComplete}
        >
          {complete.isPending ? "Menyimpan…" : "Selesaikan node"}
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      );
    }
    return null;
  }

  return (
    <NodePlayerLayout
      rightSidebar={
        <ChatSidebar
          moduleId={moduleId}
          pageContext={{ surface: "node", nodeId }}
          contextLabel={data.node.title}
        />
      }
      moduleId={moduleId}
      title={data.node.title}
      activities={data.activities}
      slide={slide}
      showResult={showResult}
      resultTone={resultTone}
      animateResult={resultEffects.animateResult}
      contentRef={contentRef}
      footer={
        showResult ? null : (
          <NodePlayerFooter
            errorMessage={errorMessage}
            reviewing={readOnly || completed}
            activityType={activity?.type}
          >
            <Button
              aria-label="Aktivitas sebelumnya"
              variant="secondary"
              size="icon"
              disabled={slide === 0}
              onClick={() => moveTo(slide - 1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.5} aria-hidden="true" />
            </Button>
            {renderPrimaryAction()}
          </NodePlayerFooter>
        )
      }
    >
      {showResult ? (
        <NodeAttemptResult
          result={attemptResult}
          animate={resultEffects.animateResult}
          error={attemptQuery.error}
          loading={attemptQuery.isFetching}
          readOnly={readOnly}
          onReload={() => void attemptQuery.refetch()}
          onReview={() => {
            setReviewing(true);
            moveTo(0);
          }}
          onRetry={handleTryAgain}
        />
      ) : activity ? (
        <NodeActivity
          key={activity.id}
          activity={activity}
          readOnly={readOnly}
          completed={completed}
          locked={locked}
          answer={answer}
          onAnswer={(value) => setAnswers((current) => ({ ...current, [activity.id]: value }))}
          result={activityResult}
        />
      ) : (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold">Aktivitas belum tersedia</h2>
          <p className="text-muted-foreground">Kembali ke Journey untuk melihat status node ini.</p>
        </div>
      )}
    </NodePlayerLayout>
  );
}
