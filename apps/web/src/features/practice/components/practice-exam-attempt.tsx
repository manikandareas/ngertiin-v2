import type { PracticeAnswer, PracticeDetail } from "@ngertiin/contracts/api";
import { ArrowLeft, ArrowRight, Flag } from "lucide-react";
import { type ReactElement, type ReactNode, useRef, useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { Button } from "../../../components/ui/button";
import { DialogFrame } from "../../../components/ui/dialog-frame";
import { cn } from "../../../lib/utils";
import { hasPracticeAnswer } from "../practice-answers";
import { usePracticeExamNavigation } from "../use-practice-exam-navigation";
import { PracticeExamHeader } from "./practice-exam-header";
import { PracticeExamQuestionMap } from "./practice-exam-question-map";
import { PracticeQuizQuestion } from "./practice-quiz-question";

type Props = {
  practice: PracticeDetail;
  backTo: string;
  answers: Record<string, PracticeAnswer>;
  canAnswer: boolean;
  active: boolean;
  seconds: number | null;
  busy: boolean;
  unsaved: boolean;
  onAnswer: (id: string, answer: PracticeAnswer) => void;
  onSubmit: () => Promise<boolean>;
  children: ReactNode;
};

const labels = {
  multiple_choice: "Pilihan Ganda",
  true_false: "Benar atau Salah",
  short_answer: "Jawaban Singkat",
  flashcard: "Flashcard",
};

export function PracticeExamAttempt({
  practice,
  backTo,
  answers,
  canAnswer,
  active,
  seconds,
  busy,
  unsaved,
  onAnswer,
  onSubmit,
  children,
}: Props): ReactElement {
  const {
    view,
    position,
    setPosition,
    flagged,
    toggleFlag,
    scrollRef,
    questionRefs,
    visibleItems,
    moveTo,
  } = usePracticeExamNavigation(practice.items);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submitTriggerRef = useRef<HTMLButtonElement | null>(null);
  const total = practice.items.length;
  const answered = practice.items.filter((item) => hasPracticeAnswer(answers[item.id])).length;
  const openConfirmation = (trigger: HTMLButtonElement) => {
    submitTriggerRef.current = trigger;
    setConfirmOpen(true);
  };

  return (
    <AppShell workspace sidebar={<span className="hidden" />} unsavedChanges={unsaved}>
      <PracticeExamHeader
        title={practice.title}
        backTo={backTo}
        canAnswer={canAnswer}
        active={active}
        seconds={seconds}
        answered={answered}
        total={total}
        view={view}
        onViewChange={(nextView) => moveTo(position, nextView)}
      />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-[1200px] px-5 py-7 pb-16 sm:px-8 sm:pt-10 [&_button]:normal-case [&_button]:tracking-normal">
          {children}
          {canAnswer ? (
            <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
              <section aria-label="Soal exam" className="min-w-0 space-y-6">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    ref={(element) => {
                      if (element) questionRefs.current.set(item.id, element);
                      else questionRefs.current.delete(item.id);
                    }}
                    className={cn(
                      "scroll-mt-7",
                      view === "list" && "rounded-card border-2 bg-card p-4 sm:p-6",
                    )}
                  >
                    <PracticeQuizQuestion
                      item={item}
                      answer={answers[item.id]}
                      busy={busy}
                      onAnswer={(id, answer) => {
                        setPosition(practice.items.findIndex((entry) => entry.id === id));
                        onAnswer(id, answer);
                      }}
                      header={
                        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-muted-foreground sm:text-base">
                          <span>
                            {item.position}. {labels[item.content.type]}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-9 shrink-0"
                            aria-label={`${flagged.has(item.id) ? "Hapus tanda" : "Tandai soal"} ${item.position}`}
                            title={flagged.has(item.id) ? "Hapus tanda" : "Tandai soal"}
                            aria-pressed={flagged.has(item.id)}
                            onClick={() => toggleFlag(item.id)}
                          >
                            <Flag
                              className={cn(
                                flagged.has(item.id) && "fill-adaptive text-adaptive-foreground",
                              )}
                            />
                          </Button>
                        </div>
                      }
                    />
                  </div>
                ))}
                <footer className="flex items-center justify-between gap-3">
                  {view === "focus" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={position === 0}
                      onClick={() => moveTo(position - 1)}
                    >
                      <ArrowLeft /> Sebelumnya
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {answered}/{total} terjawab
                    </span>
                  )}
                  {view === "focus" && position < total - 1 ? (
                    <Button size="sm" onClick={() => moveTo(position + 1)}>
                      Berikutnya <ArrowRight />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={(event) => openConfirmation(event.currentTarget)}
                    >
                      Periksa & kirim <ArrowRight />
                    </Button>
                  )}
                </footer>
              </section>
              <PracticeExamQuestionMap
                items={practice.items}
                answers={answers}
                flagged={flagged}
                position={position}
                answered={answered}
                busy={busy}
                onPositionChange={moveTo}
                onReview={openConfirmation}
              />
            </div>
          ) : null}
          {active && seconds === 0 ? (
            <p role="status" className="mt-8 text-sm text-muted-foreground">
              Waktu habis. Jawaban sedang dikirim oleh server.
            </p>
          ) : null}
        </div>
      </div>
      <DialogFrame
        open={confirmOpen && canAnswer}
        title="Kirim exam sekarang?"
        description={`${answered} dari ${total} soal terjawab. ${total - answered} soal masih kosong. Setelah dikirim, jawaban tidak dapat diubah.`}
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        returnFocus={() => submitTriggerRef.current?.focus()}
      >
        <div className="flex flex-wrap justify-end gap-3 [&_button]:normal-case [&_button]:tracking-normal">
          <Button variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>
            Periksa lagi
          </Button>
          <Button
            disabled={busy || !canAnswer}
            onClick={async () => {
              setConfirmOpen(false);
              const submitted = await onSubmit();
              if (!submitted) scrollRef.current?.scrollTo({ top: 0 });
            }}
          >
            {busy ? "Mengirim…" : "Ya, kirim jawaban"}
          </Button>
        </div>
      </DialogFrame>
    </AppShell>
  );
}
