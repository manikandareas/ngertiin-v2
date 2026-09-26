import type { PracticeAttempt, PracticeDetail } from "@ngertiin/contracts/api";
import type { ReactElement } from "react";

type Props = {
  items: PracticeDetail["items"];
  results: ReadonlyMap<string, NonNullable<PracticeAttempt["results"]>[number]>;
  score: PracticeAttempt["score"];
  xpAwarded: PracticeAttempt["xpAwarded"];
};

export function PracticeQuizResultSummary({
  items,
  results,
  score,
  xpAwarded,
}: Props): ReactElement {
  const counts = { correct: 0, partial: 0, wrong: 0, pending: 0 };
  for (const item of items) {
    const result = results.get(item.id);
    if (!result) counts.pending++;
    else if (result.score === 1) counts.correct++;
    else if (result.score === 0) counts.wrong++;
    else counts.partial++;
  }
  const revisit = items
    .filter((item) => {
      const result = results.get(item.id);
      return result !== undefined && result.score < 0.5;
    })
    .slice(0, 5);
  const stats = [
    { label: "Benar", count: counts.correct, color: "bg-success" },
    { label: "Sebagian benar", count: counts.partial, color: "bg-adaptive" },
    { label: "Salah", count: counts.wrong, color: "bg-destructive" },
    ...(counts.pending
      ? [{ label: "Belum dinilai", count: counts.pending, color: "bg-muted-foreground" }]
      : []),
  ];

  return (
    <aside
      aria-label="Ringkasan hasil kuis"
      className="grid grid-cols-[105px_minmax(0,1fr)] items-center gap-4 rounded-card border-2 bg-card p-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6 sm:p-6 lg:sticky lg:top-6 lg:block"
    >
      <div
        className="relative mx-auto flex size-[105px] items-center justify-center rounded-full sm:size-[150px] lg:mb-6 lg:size-[164px]"
        style={{
          background: `conic-gradient(var(--primary) ${(score ?? 0) * 3.6}deg, var(--muted) 0deg)`,
        }}
      >
        <div className="absolute inset-2 rounded-full bg-card sm:inset-2.5" />
        <div className="relative text-center">
          <p className="font-display text-3xl font-extrabold tabular-nums sm:text-4xl">
            {score ?? "—"}
            <span className="text-sm text-muted-foreground sm:text-base">/100</span>
          </p>
          <p className="text-[10px] text-muted-foreground sm:text-xs">Nilai kuis</p>
        </div>
      </div>
      <div>
        <h3 className="font-display font-extrabold sm:text-lg">Ringkasan hasil</h3>
        <dl className="my-4 space-y-2 text-xs sm:text-sm">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${stat.color}`} />
                {stat.label}
              </dt>
              <dd className="font-bold tabular-nums">{stat.count}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between gap-2 border-t pt-4 text-xs sm:text-sm">
          <span>XP diperoleh</span>
          <span className="rounded-lg bg-secondary px-2 py-1 font-extrabold text-secondary-foreground">
            +{xpAwarded} XP
          </span>
        </div>
      </div>
      {revisit.length > 0 ? (
        <section className="col-span-full border-t pt-5 lg:mt-5">
          <h3 className="text-sm font-bold">Perlu dipelajari lagi</h3>
          <ul className="mt-3 space-y-3">
            {revisit.map((item) => (
              <li key={item.id}>
                <a
                  href={`#result-${item.id}`}
                  className="text-xs leading-relaxed text-muted-foreground wrap-anywhere hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  Soal {item.position} ·{" "}
                  {item.content.type === "flashcard" ? item.content.front : item.content.question}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
