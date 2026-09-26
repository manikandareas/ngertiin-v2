import type { PracticeAnswer, PracticeAttempt, PracticeDetail } from "@ngertiin/contracts/api";
import type { ReactElement } from "react";
import { cn } from "../../../lib/utils";

type Props = {
  item: PracticeDetail["items"][number];
  answer: PracticeAnswer | undefined;
  result: NonNullable<PracticeAttempt["results"]>[number] | undefined;
};

const labels = {
  multiple_choice: "Pilihan ganda",
  true_false: "Benar atau salah",
  short_answer: "Jawaban singkat",
};

export function PracticeQuizResultQuestion({ item, answer, result }: Props): ReactElement | null {
  const { content } = item;
  if (content.type === "flashcard") return null;
  const correct = result?.score === 1;
  const wrong = result?.score === 0;
  const answered =
    answer !== undefined && (answer.type !== "short_answer" || answer.text.trim() !== "");
  let status = "Belum dinilai";
  let statusClass = "bg-muted";
  if (correct) {
    status = "✓ Benar";
    statusClass = "bg-success-subtle text-success-foreground";
  } else if (wrong) {
    status = "× Salah";
    statusClass = "bg-destructive/10 text-destructive";
  } else if (result) {
    status = "◐ Sebagian benar";
    statusClass = "bg-adaptive-subtle text-adaptive-foreground";
  }

  let options: string[] | null = null;
  if (content.type === "multiple_choice") options = content.options;
  else if (content.type === "true_false") options = ["Benar", "Salah"];

  let selected: number | null = null;
  if (answer?.type === "multiple_choice") selected = answer.optionIndex;
  else if (answer?.type === "true_false") selected = answer.value ? 0 : 1;

  let feedbackSummary = "Pelajari kembali materi, lalu coba lagi.";
  if (!answered) feedbackSummary = "Tidak dijawab";
  else if (!result) feedbackSummary = "Hasil penilaian belum tersedia.";
  else if (correct) feedbackSummary = "Jawabanmu sudah tepat.";

  const explanation = result?.explanation.trim();

  return (
    <article
      id={`result-${item.id}`}
      aria-labelledby={`result-title-${item.id}`}
      className="scroll-mt-6 overflow-hidden rounded-card border-2 bg-card target:outline-2 target:outline-offset-4 target:outline-primary"
    >
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            <span className="mr-2 font-extrabold text-foreground">#{item.position}</span>
            {labels[content.type]}
          </span>
          <span
            className={cn("shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold", statusClass)}
          >
            {status}
          </span>
        </div>
        <h3
          id={`result-title-${item.id}`}
          className="font-display text-lg leading-relaxed font-bold wrap-anywhere"
        >
          {content.question}
        </h3>
        {options ? (
          <ul className="mt-5 grid gap-2">
            {options.map((option, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: Option indexes are immutable answer identities within a practice item.
                key={`${item.id}-${index}`}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-2 p-3 text-sm leading-relaxed sm:p-4",
                  index === selected && correct && "border-success bg-success-subtle/40",
                  index === selected && wrong && "border-destructive/50 bg-destructive/5",
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-extrabold">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0 flex-[1_1_140px] wrap-anywhere">{option}</span>
                {index === selected ? (
                  <span
                    className={cn(
                      "ml-11 text-[11px] font-extrabold sm:ml-0",
                      correct && "text-success-foreground",
                      wrong && "text-destructive",
                    )}
                  >
                    Jawabanmu
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm">
            <p className="mb-1 text-xs text-muted-foreground">Jawabanmu</p>
            <p className="whitespace-pre-wrap wrap-anywhere">
              {answer?.type === "short_answer" && answer.text.trim() ? answer.text : "Kosong"}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-4 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        <p>{feedbackSummary}</p>
        <p className="shrink-0 font-bold text-foreground">
          Skor: {result ? result.score.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "—"}{" "}
          / 1
        </p>
      </div>
      {explanation ? (
        <details className="border-t px-4 py-3 text-sm sm:px-6">
          <summary className="cursor-pointer font-bold text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            Penjelasan
          </summary>
          <div className="mt-4 pb-2">
            <h4 className="mb-3 text-xs font-bold text-muted-foreground">Feedback AI</h4>
            <div className="space-y-4 leading-7 wrap-anywhere">
              {explanation.split(/\n\s*\n/).map((paragraph, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Paragraph order is fixed within a result explanation.
                <p key={index} className="whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </details>
      ) : null}
    </article>
  );
}
