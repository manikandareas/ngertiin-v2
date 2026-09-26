import type { PracticeAnswer, PracticeDetail } from "@ngertiin/contracts/api";
import type { ReactElement } from "react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { hasPracticeAnswer } from "../practice-answers";

type Props = {
  items: PracticeDetail["items"];
  answers: Record<string, PracticeAnswer>;
  flagged: ReadonlySet<string>;
  position: number;
  answered: number;
  busy: boolean;
  onPositionChange: (position: number) => void;
  onReview: (trigger: HTMLButtonElement) => void;
};

export function PracticeExamQuestionMap({
  items,
  answers,
  flagged,
  position,
  answered,
  busy,
  onPositionChange,
  onReview,
}: Props): ReactElement {
  const total = items.length;
  return (
    <aside className="order-first rounded-card border-2 bg-card p-5 lg:sticky lg:top-7 lg:order-last">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Peta soal</h2>
        <span className="text-xs text-muted-foreground">
          {answered}/{total}
        </span>
      </div>
      <nav
        aria-label="Nomor soal"
        className="my-4 grid max-h-56 grid-cols-5 gap-2 overflow-y-auto p-1 lg:max-h-[45dvh] lg:grid-cols-4"
      >
        {items.map((item, index) => (
          <Button
            key={item.id}
            size="icon"
            variant="outline"
            aria-current={index === position ? "step" : undefined}
            aria-label={`Soal ${index + 1}, ${hasPracticeAnswer(answers[item.id]) ? "terjawab" : "kosong"}${flagged.has(item.id) ? ", ditandai" : ""}`}
            className={cn(
              "h-11 w-full rounded-xl text-sm text-muted-foreground shadow-none hover:bg-muted active:translate-y-0",
              hasPracticeAnswer(answers[item.id]) &&
                "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary",
              flagged.has(item.id) &&
                "border-adaptive/50 bg-adaptive-subtle text-adaptive-foreground hover:bg-adaptive-subtle",
              index === position &&
                "border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-card",
              index === position &&
                !flagged.has(item.id) &&
                "bg-secondary text-secondary-foreground hover:bg-secondary",
            )}
            onClick={() => onPositionChange(index)}
          >
            {index + 1}
          </Button>
        ))}
      </nav>
      <Button
        className="mt-4 w-full"
        variant="outline"
        disabled={busy}
        onClick={(event) => onReview(event.currentTarget)}
      >
        Periksa & kirim
      </Button>
    </aside>
  );
}
