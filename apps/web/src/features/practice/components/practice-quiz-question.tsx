import type { PracticeAnswer, PracticeDetail } from "@ngertiin/contracts/api";
import type { ReactNode, Ref } from "react";

type Props = {
  item: PracticeDetail["items"][number];
  answer: PracticeAnswer | undefined;
  busy: boolean;
  questionRef?: Ref<HTMLHeadingElement>;
  header?: ReactNode;
  onAnswer: (id: string, answer: PracticeAnswer) => void;
};

const questionLabels = {
  multiple_choice: "Pilihan ganda",
  true_false: "Benar atau salah",
  short_answer: "Jawaban singkat",
};

export function PracticeQuizQuestion({ item, answer, busy, questionRef, header, onAnswer }: Props) {
  const optionClass =
    "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-sm leading-relaxed transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-default sm:gap-5 sm:p-5 sm:text-base motion-reduce:transition-none";

  if (item.content.type === "flashcard") return null;
  return (
    <article>
      {header ?? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{questionLabels[item.content.type]}</span>
          <span>
            {item.content.type === "short_answer" ? "Tulis jawabanmu" : "Pilih satu jawaban"}
          </span>
        </div>
      )}
      <h2
        ref={questionRef}
        id={`question-${item.id}`}
        tabIndex={-1}
        className="my-5 text-xl leading-relaxed font-semibold wrap-anywhere outline-none sm:my-6 sm:text-2xl sm:leading-relaxed"
      >
        {item.content.question}
      </h2>
      {item.content.type === "multiple_choice" ? (
        <fieldset aria-labelledby={`question-${item.id}`} className="grid gap-3" disabled={busy}>
          {item.content.options.map((option, index) => (
            <label key={option} className={optionClass}>
              <input
                type="radio"
                name={`answer-${item.id}`}
                className="size-4 shrink-0 accent-primary"
                checked={answer?.type === "multiple_choice" && answer.optionIndex === index}
                onChange={() => onAnswer(item.id, { type: "multiple_choice", optionIndex: index })}
              />
              <span className="min-w-0 wrap-anywhere">{option}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {item.content.type === "true_false" ? (
        <fieldset
          aria-labelledby={`question-${item.id}`}
          className="grid grid-cols-2 gap-3"
          disabled={busy}
        >
          {[true, false].map((value) => (
            <label key={String(value)} className={optionClass}>
              <input
                type="radio"
                name={`answer-${item.id}`}
                className="size-4 shrink-0 accent-primary"
                checked={answer?.type === "true_false" && answer.value === value}
                onChange={() => onAnswer(item.id, { type: "true_false", value })}
              />
              <span>{value ? "Benar" : "Salah"}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {item.content.type === "short_answer" ? (
        <textarea
          aria-labelledby={`question-${item.id}`}
          disabled={busy}
          maxLength={4_000}
          className="min-h-40 w-full resize-y rounded-xl border border-input bg-background p-4 leading-7 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          value={answer?.type === "short_answer" ? answer.text : ""}
          onChange={(event) =>
            onAnswer(item.id, { type: "short_answer", text: event.target.value })
          }
          placeholder="Tulis pemahamanmu dengan kata-katamu sendiri…"
        />
      ) : null}
    </article>
  );
}
