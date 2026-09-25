import type { PracticeAnswer, PracticeDetail } from "@ngertiin/contracts/api";
import { Button } from "../../../components/ui/button";

type PracticeQuestionProps = {
  item: PracticeDetail["items"][number];
  position: number;
  total: number;
  currentAnswer: PracticeAnswer | undefined;
  onAnswer: (answer: PracticeAnswer) => void;
};

export function PracticeQuestion({
  item,
  position,
  total,
  currentAnswer,
  onAnswer,
}: PracticeQuestionProps) {
  return (
    <article className="rounded-2xl border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        Soal {position + 1} dari {total}
      </p>
      <h2 className="mt-3 text-lg font-medium leading-relaxed">
        {item.content.type === "flashcard" ? item.content.front : item.content.question}
      </h2>
      {item.content.type === "multiple_choice" ? (
        <div className="mt-5 grid gap-2">
          {item.content.options.map((option, index) => (
            <label
              key={option}
              className="flex cursor-pointer gap-3 rounded-xl border p-3 hover:bg-muted/40"
            >
              <input
                type="radio"
                name={`answer-${item.id}`}
                checked={
                  currentAnswer?.type === "multiple_choice" && currentAnswer.optionIndex === index
                }
                onChange={() =>
                  onAnswer({
                    type: "multiple_choice",
                    optionIndex: index,
                  })
                }
              />
              {option}
            </label>
          ))}
        </div>
      ) : null}
      {item.content.type === "true_false" ? (
        <div className="mt-5 flex gap-2">
          {[true, false].map((value) => (
            <Button
              key={String(value)}
              variant={
                currentAnswer?.type === "true_false" && currentAnswer.value === value
                  ? "default"
                  : "outline"
              }
              onClick={() => onAnswer({ type: "true_false", value })}
            >
              {value ? "Benar" : "Salah"}
            </Button>
          ))}
        </div>
      ) : null}
      {item.content.type === "short_answer" ? (
        <textarea
          className="mt-5 min-h-40 w-full rounded-xl border bg-background p-3 text-sm"
          maxLength={4_000}
          value={currentAnswer?.type === "short_answer" ? currentAnswer.text : ""}
          onChange={(event) => onAnswer({ type: "short_answer", text: event.target.value })}
          placeholder="Tulis jawaban singkatmu…"
        />
      ) : null}
    </article>
  );
}
