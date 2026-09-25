import type { PracticeAnswer, PracticeAttempt, PracticeDetail } from "@ngertiin/contracts/api";

type PracticeAttemptResultProps = { data: PracticeDetail; session: PracticeAttempt };

function formatAnswer(
  answer: PracticeAnswer | undefined,
  content: PracticeDetail["items"][number]["content"],
): string {
  switch (answer?.type) {
    case "multiple_choice":
      return content.type === "multiple_choice"
        ? (content.options[answer.optionIndex] ?? "Kosong")
        : "Kosong";
    case "true_false":
      return answer.value ? "Benar" : "Salah";
    case "short_answer":
      return answer.text || "Kosong";
    case "flashcard":
      return answer.understood ? "Sudah paham" : "Perlu diulang";
    default:
      return "Kosong";
  }
}

export function PracticeAttemptResult({ data, session }: PracticeAttemptResultProps) {
  return (
    <div className="mt-8">
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Hasil latihan</p>
        <p className="mt-1 text-4xl font-semibold">
          {session.score ?? 0}
          <span className="text-lg text-muted-foreground">/100</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">+{session.xpAwarded} XP</p>
        {session.results?.some((result) => result.score < 0.5) ? (
          <div className="mt-5 border-t pt-4">
            <p className="font-medium">Perlu dipelajari lagi</p>
            <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
              {session.results
                .filter((result) => result.score < 0.5)
                .slice(0, 5)
                .map((result) => {
                  const source = data.items.find((entry) => entry.id === result.itemId);
                  return (
                    <li key={result.itemId}>
                      {source?.content.type === "flashcard"
                        ? source.content.front
                        : source?.content.question}
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : null}
      </div>
      <h2 className="mt-8 text-lg font-semibold">Pembahasan</h2>
      <div className="mt-3 grid gap-3">
        {data.items.map((entry) => {
          const result = session.results?.find((value) => value.itemId === entry.id);
          const answer = session.answers[entry.id];
          const answerLabel = formatAnswer(answer, entry.content);
          return (
            <article key={entry.id} className="rounded-xl border p-4">
              <p className="font-medium">
                {entry.content.type === "flashcard" ? entry.content.front : entry.content.question}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Jawabanmu: {answerLabel}</p>
              <p className="mt-1 text-sm">Skor: {result?.score ?? 0}/1</p>
              {result?.explanation ? (
                <p className="mt-2 text-sm text-muted-foreground">{result.explanation}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
