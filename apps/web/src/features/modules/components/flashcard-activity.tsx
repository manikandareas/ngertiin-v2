import type { PublicActivity } from "@ngertiin/contracts/api";
import { RotateCcw } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";

interface FlashcardsProps {
  activity: Extract<PublicActivity, { type: "flashcard" }>;
}

export function Flashcards({ activity }: FlashcardsProps): JSX.Element | null {
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const card = activity.content.cards[index];
  if (!card) return null;
  const move = (next: number) => {
    setIndex(next);
    setShowBack(false);
  };
  return (
    <article className="space-y-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Flashcard</span>
        <span>
          {index + 1} / {activity.content.cards.length}
        </span>
      </div>
      <button
        className="mt-5 grid min-h-64 w-full place-items-center rounded-2xl border-2 border-border bg-muted p-8 text-center text-2xl font-bold text-foreground shadow-[0_5px_0_var(--border)] focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => setShowBack((value) => !value)}
        type="button"
      >
        <span>{showBack ? card.back : card.front}</span>
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">Klik kartu untuk membalik</p>
      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <Button disabled={index === 0} onClick={() => move(index - 1)} variant="outline">
          Kartu sebelumnya
        </Button>
        {showBack ? (
          <Button onClick={() => setShowBack(false)} variant="outline">
            <RotateCcw className="mr-2 size-4" />
            Balik lagi
          </Button>
        ) : null}
        <Button
          disabled={index === activity.content.cards.length - 1}
          onClick={() => move(index + 1)}
        >
          Kartu berikutnya
        </Button>
      </div>
    </article>
  );
}
