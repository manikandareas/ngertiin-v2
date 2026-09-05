import type { AssessmentAnswer, PublicActivity } from "@ngertiin/contracts/api";
import { BookOpen, Check, Layers } from "lucide-react";
import type { JSX } from "react";
import { type ActivityResult, Assessment } from "./assessment-activity";
import { Flashcards } from "./flashcard-activity";
import { Lesson } from "./lesson-activity";

const activityPresentation = {
  lesson: { label: "Penjelasan", icon: BookOpen },
  flashcard: { label: "Flashcard", icon: Layers },
  multiple_choice: { label: "Pilihan ganda", icon: Check },
  true_false: { label: "Benar atau salah", icon: Check },
  short_answer: { label: "Jawaban singkat", icon: Check },
} satisfies Record<PublicActivity["type"], { label: string; icon: typeof Check }>;

interface NodeActivityProps {
  activity: PublicActivity;
  title: string;
  readOnly: boolean;
  completed: boolean;
  locked: boolean;
  answer: AssessmentAnswer | undefined;
  onAnswer: (answer: AssessmentAnswer) => void;
  result: ActivityResult | undefined;
}

export function NodeActivity({
  activity,
  title,
  readOnly,
  completed,
  locked,
  answer,
  onAnswer,
  result,
}: NodeActivityProps): JSX.Element {
  const { label, icon: Icon } = activityPresentation[activity.type];
  let modeLabel = "";
  if (readOnly) modeLabel = " · Diarsipkan";
  else if (completed) modeLabel = " · Mode review";

  let content: JSX.Element;
  switch (activity.type) {
    case "lesson":
      content = <Lesson activity={activity} />;
      break;
    case "flashcard":
      content = <Flashcards activity={activity} />;
      break;
    default:
      content = (
        <Assessment
          activity={activity}
          answer={answer}
          onAnswer={onAnswer}
          result={result}
          readOnly={locked}
        />
      );
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="mb-8 flex items-center gap-3 text-sm font-bold text-muted-foreground">
        <span className="grid size-10 place-items-center rounded-xl bg-muted text-primary">
          <Icon className="size-5" />
        </span>
        <span>
          {label}
          {modeLabel}
        </span>
      </div>
      <h1 className="mb-7 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        {title}
      </h1>
      {content}
    </div>
  );
}
