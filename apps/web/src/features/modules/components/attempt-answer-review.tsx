import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Attempt } from "@ngertiin/contracts/api";
import type { JSX } from "react";

type ActivityResult = Extract<
  Attempt,
  { evaluationStatus: "completed" }
>["activityResults"][number];

interface AttemptAnswerReviewProps {
  activities: ActivityResult[];
}

function getAnswerStatus(activity: ActivityResult): string {
  if (activity.correct) return "Benar";
  if (activity.score > 0) return "Sebagian tepat";
  return "Belum tepat";
}

export function AttemptAnswerReview({ activities }: AttemptAnswerReviewProps): JSX.Element | null {
  if (activities.length === 0) return null;
  return (
    <section className="space-y-4" aria-label="Ulasan jawaban">
      <h3 className="font-bold">Ulasan jawaban</h3>
      <ol className="space-y-3">
        {activities.map((activity, index) => (
          <li
            key={activity.activityId}
            className={`rounded-card p-5 ${activity.correct ? "bg-success-subtle/50" : "bg-muted"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {activity.correct ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="size-4 text-success-foreground"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                )}
                Soal {index + 1}
                <span
                  className={`text-xs ${activity.correct ? "text-success-foreground" : "text-muted-foreground"}`}
                >
                  {getAnswerStatus(activity)}
                </span>
              </h4>
              <p className="text-xs tabular-nums text-muted-foreground">
                {activity.score} / {activity.maxScore} poin
              </p>
            </div>
            {activity.explanation ? (
              <p className="mt-3 text-sm leading-7 text-foreground">{activity.explanation}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
