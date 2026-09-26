import type { PracticeAttempt, PracticeDetail } from "@ngertiin/contracts/api";
import type { ReactElement } from "react";
import { PracticeQuizResultQuestion } from "./practice-quiz-result-question";
import { PracticeQuizResultSummary } from "./practice-quiz-result-summary";

type Props = { data: PracticeDetail; session: PracticeAttempt };

export function PracticeQuizResult({ data, session }: Props): ReactElement {
  const results = new Map(session.results?.map((result) => [result.itemId, result]));

  return (
    <div>
      <header className="mb-7 sm:mb-8">
        <p className="mb-2 text-xs text-muted-foreground">
          Hasil {data.kind === "exam" ? "exam" : "kuis"}
        </p>
        <h2 className="font-display text-2xl font-extrabold wrap-anywhere sm:text-3xl">
          {data.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{data.items.length} soal · Selesai</p>
      </header>
      <div className="grid items-start gap-7 lg:grid-cols-[320px_minmax(0,1fr)]">
        <PracticeQuizResultSummary
          kind={data.kind === "exam" ? "exam" : "quiz"}
          items={data.items}
          results={results}
          score={session.score}
          xpAwarded={session.xpAwarded}
        />
        <section aria-label="Hasil per soal" className="min-w-0">
          <div className="grid gap-5">
            {data.items.map((item) => (
              <PracticeQuizResultQuestion
                key={item.id}
                item={item}
                answer={session.answers[item.id]}
                result={results.get(item.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
