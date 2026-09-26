import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { PracticeAttemptOutcome } from "../features/practice/components/practice-attempt-outcome";
import { PracticeFlashcardAttempt } from "../features/practice/components/practice-flashcard-attempt";
import { PracticeQuestion } from "../features/practice/components/practice-question";
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
  const item = data?.items[position];
  const currentAnswer = item ? answers[item.id] : undefined;
  const answered = data?.items.filter((entry) => answers[entry.id] !== undefined).length ?? 0;
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
  return (
    <AppShell sidebar={active && data?.kind === "exam" ? <span className="hidden" /> : undefined}>
      <div className="mx-auto max-w-3xl pb-16">
        <Link
          to={`/modules/${moduleId}/practice/${practiceId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
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
        {data && session ? (
          <>
            <header className="mt-7 flex flex-wrap items-start justify-between gap-3 border-b pb-5">
              <div>
                <p className="text-sm text-muted-foreground">
                  {data.kind === "flashcard" ? "Flashcard" : data.kind === "quiz" ? "Kuis" : "Exam"}{" "}
                  · {answered}/{data.items.length} terjawab
                </p>
                <h1 className="mt-1 text-2xl font-semibold">{data.title}</h1>
              </div>
              {seconds !== null && active ? (
                <p
                  role="timer"
                  className="rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums"
                >
                  {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                </p>
              ) : null}
            </header>
            {active && seconds === 0 ? (
              <p role="status" className="mt-5 text-sm text-muted-foreground">
                Waktu habis. Jawaban sedang dikirim oleh server.
              </p>
            ) : null}
            {canAnswer && data.kind !== "flashcard" && item ? (
              <div className="mt-8">
                <nav aria-label="Nomor soal" className="mb-6 flex flex-wrap gap-2">
                  {data.items.map((entry, index) => (
                    <Button
                      key={entry.id}
                      size="sm"
                      variant={
                        index === position ? "default" : answers[entry.id] ? "secondary" : "outline"
                      }
                      onClick={() => setPosition(index)}
                    >
                      {index + 1}
                    </Button>
                  ))}
                </nav>
                <PracticeQuestion
                  item={item}
                  position={position}
                  total={data.items.length}
                  currentAnswer={currentAnswer}
                  onAnswer={(answer) => void saveAnswer(item.id, answer)}
                />
                <div className="mt-5 flex justify-between">
                  <Button
                    variant="outline"
                    disabled={position === 0}
                    onClick={() => setPosition((old) => old - 1)}
                  >
                    <ArrowLeft className="size-4" />
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    disabled={position >= data.items.length - 1}
                    onClick={() => setPosition((old) => old + 1)}
                  >
                    Berikutnya
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
                <div className="mt-7 flex items-center justify-between border-t pt-5">
                  <p role="status" className="text-xs text-muted-foreground">
                    {unsaved ? "Belum tersimpan" : "Jawaban tersimpan"}
                  </p>
                  <Button
                    disabled={busy || (data.kind === "quiz" && answered < data.items.length)}
                    onClick={() => void submit()}
                  >
                    Kirim jawaban
                  </Button>
                </div>
              </div>
            ) : null}
            {outcome}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
