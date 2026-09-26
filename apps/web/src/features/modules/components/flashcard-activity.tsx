import type { PublicActivity } from "@ngertiin/contracts/api";
import { FlashcardDeck } from "../../../components/flashcards/flashcard-deck";

interface FlashcardsProps {
  activity: Extract<PublicActivity, { type: "flashcard" }>;
  reading?: boolean;
}

export function Flashcards({ activity, reading = false }: FlashcardsProps) {
  if (reading) {
    return (
      <article className="space-y-4">
        {activity.content.cards.map((card, index) => (
          <section
            // biome-ignore lint/suspicious/noArrayIndexKey: Immutable reading list; repeated cards are valid.
            key={index}
            className="overflow-hidden rounded-2xl border bg-background"
          >
            <p className="whitespace-pre-wrap p-5 font-semibold leading-7">{card.front}</p>
            <p className="whitespace-pre-wrap border-t bg-muted/30 p-5 leading-7">{card.back}</p>
          </section>
        ))}
      </article>
    );
  }
  return (
    <FlashcardDeck
      key={activity.id}
      cards={activity.content.cards.map((card, index) => ({
        id: `${activity.id}:${index}`,
        front: card.front,
        back: card.back,
      }))}
    />
  );
}
