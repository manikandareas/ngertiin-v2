import type { AssessmentAnswer, PublicActivity } from "@ngertiin/contracts/api";
import type { JSX } from "react";
import { type ActivityResult, Assessment } from "./assessment-activity";
import { Flashcards } from "./flashcard-activity";
import { Lesson } from "./lesson-activity";

interface NodeActivityProps {
  activity: PublicActivity;
  citationReading?: boolean;
  readOnly: boolean;
  completed: boolean;
  locked: boolean;
  answer: AssessmentAnswer | undefined;
  onAnswer: (answer: AssessmentAnswer) => void;
  result: ActivityResult | undefined;
}

export function NodeActivity({
  activity,
  citationReading = false,
  readOnly,
  completed,
  locked,
  answer,
  onAnswer,
  result,
}: NodeActivityProps): JSX.Element {
  let modeLabel = "";
  if (readOnly) modeLabel = "Diarsipkan";
  else if (completed) modeLabel = "Mode review";

  let content: JSX.Element;
  switch (activity.type) {
    case "lesson":
      content = <Lesson activity={activity} />;
      break;
    case "flashcard":
      content = <Flashcards activity={activity} reading={citationReading} />;
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
      {modeLabel ? (
        <p className="mb-6 text-xs font-bold text-muted-foreground">{modeLabel}</p>
      ) : null}
      {content}
    </div>
  );
}
