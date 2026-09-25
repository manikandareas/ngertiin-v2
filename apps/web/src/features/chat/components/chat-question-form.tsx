import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { useModules } from "../../modules/api/use-modules";
import { ChatInteractionComposer } from "./chat-interaction-composer";
import { type InteractionFormProps, interactionCardClass } from "./chat-interaction-types";

const actionClass =
  "h-9 rounded-full border px-3 text-sm font-semibold normal-case tracking-normal shadow-none active:translate-y-0";
const fieldClass =
  "w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";

export function ChatQuestionForm({ interaction, busy, statusLabel, submit }: InteractionFormProps) {
  const fieldId = useId();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const modules = useModules({ status: "ready" });
  const available = modules.data?.pages.flatMap((page) => page.data) ?? [];
  const pending = interaction.status === "pending";
  const questions = interaction.questions ?? [];
  const currentQuestion = questions[step];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const hasAnswer = (question: (typeof questions)[number]) => {
    const answer = answers[question.id];
    return Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim());
  };
  const canContinue = !currentQuestion?.required || hasAnswer(currentQuestion);
  const advance = () => {
    if (!pending || busy || !canContinue) return;
    if (step < questions.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    const unanswered = questions.findIndex((question) => question.required && !hasAnswer(question));
    if (unanswered >= 0) {
      setStep(unanswered);
      return;
    }
    void submit({
      decision: "answer",
      responseId: crypto.randomUUID(),
      answers: Object.fromEntries(
        Object.entries(answers).filter(([, value]) =>
          Array.isArray(value) ? value.length > 0 : Boolean(value.trim()),
        ),
      ),
    });
  };
  return (
    <>
      <div className={interactionCardClass}>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4">
          <span className="text-xs font-medium text-muted-foreground">Pertanyaan untukmu</span>
          {pending ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-full text-muted-foreground"
              aria-label="Batalkan pertanyaan"
              disabled={busy}
              onClick={() => void submit({ decision: "reject", responseId: crypto.randomUUID() })}
            >
              <X aria-hidden="true" />
            </Button>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">{statusLabel}</span>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
          {(pending ? questions.slice(step, step + 1) : questions).map((question) => (
            <fieldset
              key={question.id}
              disabled={!pending || busy}
              className="min-w-0 space-y-3 not-first:mt-5"
            >
              <legend className="mb-3 w-full break-words text-base font-semibold leading-6">
                {question.label}
                {!question.required && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Opsional</span>
                )}
              </legend>
              {question.kind === "text" ? (
                <p className="text-sm text-muted-foreground">
                  Tulis jawabanmu di kolom pesan di bawah.
                </p>
              ) : question.kind === "module" ? (
                <>
                  <select
                    aria-label={question.label}
                    required={question.required}
                    className={fieldClass}
                    value={typeof answers[question.id] === "string" ? answers[question.id] : ""}
                    onChange={(event) =>
                      setAnswers((old) => ({ ...old, [question.id]: event.target.value }))
                    }
                  >
                    <option value="">
                      {modules.isPending ? "Memuat modul…" : "Pilih modul tujuan"}
                    </option>
                    {available.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.title ?? "Modul"}
                      </option>
                    ))}
                  </select>
                  {modules.isError ? (
                    <p role="alert" className="text-xs text-destructive">
                      Modul belum dapat dimuat.{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => void modules.refetch()}
                      >
                        Coba lagi
                      </button>
                    </p>
                  ) : !modules.isPending && !available.length ? (
                    <p className="text-xs text-muted-foreground">
                      Belum ada modul siap.{" "}
                      <Link to="/modules/new" className="font-medium text-link underline">
                        Buat modul
                      </Link>{" "}
                      dahulu.
                    </p>
                  ) : null}
                  {modules.hasNextPage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className={actionClass}
                      disabled={modules.isFetchingNextPage}
                      onClick={() => void modules.fetchNextPage()}
                    >
                      {modules.isFetchingNextPage ? "Memuat…" : "Tampilkan modul lain"}
                    </Button>
                  )}
                </>
              ) : (
                <div className="space-y-1">
                  {question.kind === "multiple_choice" && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      Boleh pilih lebih dari satu.
                    </p>
                  )}
                  {question.options?.map((option) => {
                    const selected =
                      question.kind === "multiple_choice"
                        ? Array.isArray(answers[question.id]) &&
                          answers[question.id].includes(option.value)
                        : answers[question.id] === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 motion-safe:transition-colors hover:bg-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                          selected && "bg-accent text-accent-foreground hover:bg-accent",
                          (!pending || busy) && "cursor-default opacity-70",
                        )}
                      >
                        <input
                          type={question.kind === "multiple_choice" ? "checkbox" : "radio"}
                          name={`${fieldId}-${question.id}`}
                          value={option.value}
                          checked={selected}
                          className="size-4 shrink-0 accent-[var(--ring)]"
                          onChange={(event) =>
                            setAnswers((old) => {
                              if (question.kind !== "multiple_choice")
                                return { ...old, [question.id]: option.value };
                              const previous = old[question.id];
                              const selectedValues = Array.isArray(previous) ? previous : [];
                              return {
                                ...old,
                                [question.id]: event.target.checked
                                  ? [...selectedValues, option.value]
                                  : selectedValues.filter((value) => value !== option.value),
                              };
                            })
                          }
                        />
                        <span className="min-w-0 break-words leading-5">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))}
        </div>
        {pending && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-full text-muted-foreground"
                aria-label="Pertanyaan sebelumnya"
                disabled={busy || step === 0}
                onClick={() => setStep((value) => value - 1)}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <span
                aria-live="polite"
                className="min-w-10 text-center text-xs tabular-nums text-muted-foreground"
              >
                {step + 1} / {questions.length}
              </span>
            </div>
            <div className="flex min-h-9 items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className={cn(actionClass, "text-muted-foreground")}
                disabled={busy}
                onClick={() => void submit({ decision: "reject", responseId: crypto.randomUUID() })}
              >
                Batalkan
              </Button>
              <Button
                size="sm"
                className={actionClass}
                disabled={busy || !canContinue}
                onClick={advance}
              >
                {busy
                  ? "Menyimpan…"
                  : step === questions.length - 1
                    ? "Kirim jawaban"
                    : "Berikutnya"}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <ChatInteractionComposer
        input={{
          value:
            currentQuestion?.kind === "text" && typeof currentAnswer === "string"
              ? currentAnswer
              : "",
          onChange: (value) => {
            if (currentQuestion?.kind === "text")
              setAnswers((old) => ({ ...old, [currentQuestion.id]: value }));
          },
          onSend: advance,
          disabled: !pending || busy || currentQuestion?.kind !== "text",
          placeholder:
            currentQuestion?.kind === "text"
              ? currentQuestion.label
              : "Pilih jawaban pada kartu di atas…",
          label: step === questions.length - 1 ? "Kirim jawaban" : "Pertanyaan berikutnya",
        }}
      />
    </>
  );
}
