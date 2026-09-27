import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { PracticeAttemptOutcome } from "../features/practice/components/practice-attempt-outcome";
import { PracticeExamAttempt } from "../features/practice/components/practice-exam-attempt";
import { PracticeFlashcardAttempt } from "../features/practice/components/practice-flashcard-attempt";
import { PracticeQuizAttempt } from "../features/practice/components/practice-quiz-attempt";
import { usePracticeAttempt } from "../features/practice/use-practice-attempt";

export default function PracticeAttemptPage() {
  const { attemptId } = useParams();
  return <PracticeAttemptSession key={attemptId} />;
}

function PracticeAttemptSession() {
  const { moduleId, practiceId, attemptId } = useParams();
  const {
    practice,
    attempt,
    answers,
    answersReady,
    unsaved,
    error,
    busy,
    saveAnswer,
    submit,
    retryEvaluation,
    markFlashcard,
    active,
    seconds,
    canAnswer,
  } = usePracticeAttempt(practiceId, attemptId);
  const [position, setPosition] = useState(0);
  const data = practice.data;
  const session = attempt.data;
  const outcome =
    data && session ? (
      <PracticeAttemptOutcome
        data={data}
        session={session}
        busy={busy}
        error={error}
        onRetryEvaluation={() => void retryEvaluation()}
      />
    ) : null;

  if (data?.kind === "flashcard" && session) {
    return (
      <PracticeFlashcardAttempt
        practice={data}
        attemptId={session.id}
        answers={answers}
        canAnswer={canAnswer && answersReady}
        busy={busy}
        unsaved={unsaved}
        onMark={markFlashcard}
      >
        {outcome}
      </PracticeFlashcardAttempt>
    );
  }
  if (data?.kind === "quiz" && session) {
    return (
      <PracticeQuizAttempt
        practice={data}
        backTo={`/modules/${moduleId}/practice/${practiceId}`}
        answers={answers}
        position={position}
        canAnswer={canAnswer}
        completed={session.status === "completed"}
        busy={busy}
        unsaved={unsaved}
        onPositionChange={setPosition}
        onAnswer={(id, answer) => void saveAnswer(id, answer)}
        onSubmit={() => void submit()}
      >
        {active && seconds === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            Waktu habis. Jawaban sedang dikirim oleh server.
          </p>
        ) : null}
        {outcome}
      </PracticeQuizAttempt>
    );
  }
  if (data?.kind === "exam" && session) {
    return (
      <PracticeExamAttempt
        practice={data}
        backTo={`/modules/${moduleId}/practice/${practiceId}`}
        answers={answers}
        canAnswer={canAnswer && answersReady}
        active={active}
        seconds={seconds}
        busy={busy}
        unsaved={unsaved}
        onAnswer={(id, answer) => void saveAnswer(id, answer)}
        onSubmit={submit}
      >
        {outcome}
      </PracticeExamAttempt>
    );
  }
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl pb-16">
        <Link
          to={`/modules/${moduleId}/practice/${practiceId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon
            icon={ArrowLeft02Icon}
            strokeWidth={1.5}
            aria-hidden="true"
            className="size-4"
          />{" "}
          Kembali ke latihan
        </Link>
        {practice.isPending || attempt.isPending ? (
          <p className="mt-7 text-sm text-muted-foreground">Memuat sesi…</p>
        ) : null}
        {practice.isError || attempt.isError ? (
          <p role="alert" className="mt-7 text-sm text-destructive">
            Sesi belum dapat dimuat.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
