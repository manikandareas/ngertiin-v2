import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PublicActivity } from "@ngertiin/contracts/api";
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
      <div className="relative mt-5">
        <Button
          aria-label="Kartu sebelumnya"
          disabled={index === 0}
          className="absolute -left-6 top-1/2 z-10 -translate-y-1/2"
          onClick={() => move(index - 1)}
          size="icon"
          type="button"
          variant="secondary"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.5} aria-hidden="true" />
        </Button>
        <button
          className="grid min-h-64 w-full place-items-center rounded-2xl border-2 border-border bg-muted p-8 text-center text-2xl font-bold text-foreground shadow-[0_5px_0_var(--border)] focus-visible:outline-2 focus-visible:outline-ring"
          aria-pressed={showBack}
          onClick={() => setShowBack((value) => !value)}
          type="button"
        >
          <span>{showBack ? card.back : card.front}</span>
        </button>
        <Button
          aria-label="Kartu berikutnya"
          disabled={index === activity.content.cards.length - 1}
          className="absolute -right-6 top-1/2 z-10 -translate-y-1/2"
          onClick={() => move(index + 1)}
          size="icon"
          type="button"
          variant="secondary"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Klik kartu untuk membalik</p>
    </article>
  );
}
