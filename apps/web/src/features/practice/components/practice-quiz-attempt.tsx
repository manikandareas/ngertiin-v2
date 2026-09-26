import type { PracticeAnswer, PracticeDetail } from "@ngertiin/contracts/api";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../../components/app-shell";
import { ThemeToggle } from "../../../components/theme-toggle";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

import { PracticeQuizQuestion } from "./practice-quiz-question";

type Props = {
  practice: PracticeDetail;
  backTo: string;
  answers: Record<string, PracticeAnswer>;
  position: number;
  canAnswer: boolean;
  completed: boolean;
  busy: boolean;
  unsaved: boolean;
  onPositionChange: (position: number) => void;
  onAnswer: (id: string, answer: PracticeAnswer) => void;
  onSubmit: () => void;
  children: ReactNode;
};

function hasAnswer(answer: PracticeAnswer | undefined) {
  return answer !== undefined && (answer.type !== "short_answer" || answer.text.trim() !== "");
}

export function PracticeQuizAttempt({
  practice,
  backTo,
  answers,
  position,
  canAnswer,
  completed,
  busy,
  unsaved,
  onPositionChange,
  onAnswer,
  onSubmit,
  children,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const item = practice.items[position];
  const answer = item ? answers[item.id] : undefined;
  const answered = practice.items.filter((entry) => hasAnswer(answers[entry.id])).length;
  const total = practice.items.length;
  const last = position === total - 1;
  let saveStatus: string | null = null;
  if (unsaved) saveStatus = "Belum tersimpan";
  else if (hasAnswer(answer)) saveStatus = "Jawaban tersimpan";
  let nextLabel = "Lanjutkan";
  if (busy) nextLabel = "Mengirim…";
  else if (last) nextLabel = "Kirim jawaban";
  const moveTo = (next: number) => {
    onPositionChange(next);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
      questionRef.current?.focus({ preventScroll: true });
    });
  };

  return (
    <AppShell workspace unsavedChanges={unsaved}>
      <header className="relative shrink-0 border-b bg-background px-5 sm:px-8">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 sm:h-15 sm:gap-4">
          <Button asChild variant="ghost" size="icon" className="size-9 rounded-full">
            <Link to={backTo} aria-label="Kembali ke detail latihan">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:justify-center">
            <h1 className="truncate text-sm font-bold sm:text-base" title={practice.title}>
              {practice.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            {canAnswer && item ? (
              <span className="tabular-nums">
                <span className="sr-only">Soal </span>
                {String(position + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </span>
            ) : null}
            <span className="hidden sm:inline">{answered} terjawab</span>
          </div>
          <ThemeToggle />
        </div>
        {!completed ? (
          <progress
            aria-label={`${answered} dari ${total} soal terjawab`}
            className="learning-progress absolute inset-x-0 bottom-0 h-[3px]! rounded-none!"
            value={answered}
            max={Math.max(1, total)}
          />
        ) : null}
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className={cn(
            "mx-auto px-5 py-7 sm:px-8 sm:py-10",
            completed ? "max-w-[1200px]" : "max-w-[864px]",
          )}
        >
          {canAnswer && item && item.content.type !== "flashcard" ? (
            <>
              <PracticeQuizQuestion
                item={item}
                answer={answer}
                busy={busy}
                saveStatus={saveStatus}
                questionRef={questionRef}
                onAnswer={onAnswer}
              />
              <footer className="mt-7">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="normal-case tracking-normal"
                    disabled={busy || position === 0}
                    onClick={() => moveTo(position - 1)}
                  >
                    <ArrowLeft /> Sebelumnya
                  </Button>
                  <Button
                    size="sm"
                    className="normal-case tracking-normal"
                    disabled={busy || (last ? answered < total : !hasAnswer(answer))}
                    onClick={() => (last ? onSubmit() : moveTo(position + 1))}
                  >
                    {nextLabel}
                    {!last ? <ArrowRight /> : null}
                  </Button>
                </div>
              </footer>
            </>
          ) : null}
          {children}
        </div>
      </div>
    </AppShell>
  );
}
