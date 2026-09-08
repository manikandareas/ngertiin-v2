import type { PublicActivity } from "@ngertiin/contracts/api";
import { type JSX, lazy, Suspense } from "react";

const MarkdownLesson = lazy(() =>
  import("./markdown-lesson").then((module) => ({ default: module.MarkdownLesson })),
);

interface LessonProps {
  activity: Extract<PublicActivity, { type: "lesson" }>;
}

export function Lesson({ activity }: LessonProps): JSX.Element {
  if ("format" in activity.content)
    return (
      <Suspense fallback={<p className="text-muted-foreground">Menyiapkan materi…</p>}>
        <MarkdownLesson key={activity.id} activityId={activity.id} content={activity.content} />
      </Suspense>
    );
  return (
    <article className="space-y-5">
      {activity.content.introduction ? (
        <p className="text-lg leading-8 text-foreground">{activity.content.introduction}</p>
      ) : null}
      <p className="mt-5 whitespace-pre-wrap leading-8 text-foreground">
        {activity.content.explanation}
      </p>
      <h2 className="mt-7 text-lg font-bold">Poin penting</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground">
        {activity.content.keyPoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {activity.content.examples?.length ? (
        <>
          <h2 className="mt-7 text-lg font-bold">Contoh</h2>
          <div className="mt-3 space-y-3">
            {activity.content.examples.map((example) => (
              <p className="rounded-2xl bg-muted p-4 leading-7" key={example}>
                {example}
              </p>
            ))}
          </div>
        </>
      ) : null}
      {activity.content.summary ? (
        <div className="mt-7 rounded-2xl bg-secondary p-5">
          <h2 className="font-bold text-secondary-foreground">Ringkasan</h2>
          <p className="mt-2 leading-7 text-secondary-foreground">{activity.content.summary}</p>
        </div>
      ) : null}
    </article>
  );
}
