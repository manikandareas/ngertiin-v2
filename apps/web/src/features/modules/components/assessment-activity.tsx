import type { AssessmentAnswer, AttemptResult, PublicActivity } from "@ngertiin/contracts/api";
import type { JSX } from "react";

export type ActivityResult = Extract<
  AttemptResult["attempt"],
  { evaluationStatus: "completed" }
>["activityResults"][number];
type AssessmentActivity = Exclude<PublicActivity, { type: "lesson" | "flashcard" }>;

interface AssessmentInputProps {
  activity: AssessmentActivity;
  answer: AssessmentAnswer | undefined;
  onAnswer: (answer: AssessmentAnswer) => void;
  readOnly: boolean;
}

interface AssessmentProps extends AssessmentInputProps {
  result: ActivityResult | undefined;
}

function getPrompt(activity: AssessmentActivity): string {
  switch (activity.type) {
    case "multiple_choice":
      return activity.content.question;
    case "true_false":
      return activity.content.statement;
    case "short_answer":
      return activity.content.prompt;
  }
}

export function Assessment({
  activity,
  answer,
  onAnswer,
  result,
  readOnly,
}: AssessmentProps): JSX.Element {
  const prompt = getPrompt(activity);
  return (
    <article className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Assessment
      </p>
      <h2 className="mt-3 text-xl font-bold">{prompt}</h2>
      <AssessmentInput
        activity={activity}
        answer={answer}
        onAnswer={onAnswer}
        readOnly={readOnly}
      />
      {result ? (
        <div
          className={`mt-5 rounded-xl p-4 text-sm ${result.correct ? "bg-success-subtle text-success-foreground" : "bg-destructive/10 text-destructive"}`}
        >
          <p className="font-semibold">
            {result.correct ? "Jawaban benar" : "Jawaban belum tepat"}
          </p>
          <p className="mt-1">
            Skor {Math.round(result.score * 100)} / {Math.round(result.maxScore * 100)}
          </p>
          <p className="mt-1">{result.explanation}</p>
        </div>
      ) : null}
    </article>
  );
}

function AssessmentInput({
  activity,
  answer,
  onAnswer,
  readOnly,
}: AssessmentInputProps): JSX.Element {
  if (activity.type === "multiple_choice") {
    return (
      <fieldset className="mt-5 space-y-2">
        {activity.content.options.map((option, optionIndex) => (
          <label
            className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-border p-5 transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
            key={option}
          >
            <input
              checked={Boolean(
                answer && "optionIndex" in answer && answer.optionIndex === optionIndex,
              )}
              className="accent-primary"
              name={activity.id}
              onChange={() => onAnswer({ optionIndex })}
              type="radio"
              disabled={readOnly}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (activity.type === "true_false") {
    return (
      <fieldset className="mt-5 grid grid-cols-2 gap-3">
        {[true, false].map((value) => (
          <label
            className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-border p-5 transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
            key={String(value)}
          >
            <input
              checked={Boolean(answer && "value" in answer && answer.value === value)}
              className="accent-primary"
              name={activity.id}
              onChange={() => onAnswer({ value })}
              type="radio"
              disabled={readOnly}
            />
            <span>{value ? "Benar" : "Salah"}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  const text = answer && "text" in answer ? answer.text : "";
  return (
    <div className="mt-5">
      <textarea
        aria-label="Jawaban singkat"
        aria-describedby={`${activity.id}-counter`}
        className="min-h-40 w-full resize-y rounded-xl border border-input p-4 leading-7 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        onChange={(event) => {
          if (Array.from(event.target.value).length <= 4_000) {
            onAnswer({ text: event.target.value });
          }
        }}
        placeholder="Tulis jawabanmu di sini…"
        value={text}
        disabled={readOnly}
      />
      <p className="mt-2 text-right text-xs text-muted-foreground" id={`${activity.id}-counter`}>
        {Array.from(text).length.toLocaleString()} / 4.000
      </p>
    </div>
  );
}
