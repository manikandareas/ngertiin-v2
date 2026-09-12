import { ArrowLeft01Icon, ArrowRight01Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PublicActivity } from "@ngertiin/contracts/api";
import type { JSX } from "react";
import { useRef, useState } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { FlashcardDecoration, flashcardThemes } from "./flashcard-decoration";

const faceClassName =
  "relative col-start-1 row-start-1 flex min-h-84 min-w-0 flex-col overflow-hidden rounded-card border-2 border-(--flashcard-edge) p-[clamp(1.75rem,4vw,2rem)] text-(--flashcard-ink) shadow-[0_5px_0_var(--border)] backface-hidden";
const footerClassName =
  "relative z-1 mt-auto flex items-center justify-between gap-4 text-caption leading-relaxed [&_svg]:shrink-0";
const badgeClassName =
  "border-(--flashcard-badge-edge) bg-(--flashcard-surface) text-(--flashcard-ink)";

interface FlashcardsProps {
  activity: Extract<PublicActivity, { type: "flashcard" }>;
}

export function Flashcards({ activity }: FlashcardsProps): JSX.Element | null {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const card = activity.content.cards[index];
  const theme = flashcardThemes[index % flashcardThemes.length];
  if (!card) return null;
  const move = (next: number) => {
    setIndex(next);
    setShowBack(false);
    if (next === 0 || next === activity.content.cards.length - 1) {
      cardRef.current?.focus({ preventScroll: true });
    }
  };

  return (
    <article className="space-y-6">
      <div className="flex items-center justify-between gap-3 text-caption text-muted-foreground">
        <span className="font-bold">Flashcard</span>
        <span
          className="text-caption tabular-nums text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          Kartu <span className="font-bold text-foreground">{index + 1}</span> dari{" "}
          {activity.content.cards.length}
        </span>
      </div>
      <div
        className="flashcard-theme relative isolate before:absolute before:inset-x-1 before:top-1.5 before:-bottom-1.5 before:-z-1 before:-rotate-2 before:rounded-card before:border-2 before:border-border before:bg-muted after:absolute after:inset-x-0.5 after:top-1.5 after:-bottom-1.5 after:-z-1 after:rotate-[1.5deg] after:rounded-card after:border-2 after:border-border after:bg-(--flashcard-layer)"
        data-theme={theme}
      >
        <button
          ref={cardRef}
          className="flashcard-button block w-full cursor-pointer rounded-card p-0 text-left perspective-[1500px] focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-ring"
          aria-pressed={showBack}
          onClick={() => setShowBack((value) => !value)}
          type="button"
        >
          <span className="sr-only">Balik kartu. </span>
          {/* Remount only the faces so a new card starts on its front without a reverse flip. */}
          <span
            key={index}
            className="flashcard-rotor grid transform-3d data-[flipped=true]:[transform:rotateY(180deg)] motion-safe:transition-transform motion-safe:duration-[620ms] motion-safe:ease-[cubic-bezier(0.22,0.75,0.22,1)]"
            data-flipped={showBack}
          >
            <span className={`${faceClassName} bg-(--flashcard-surface)`} aria-hidden={showBack}>
              <span className="flex items-center justify-between gap-3">
                <span className="text-caption font-bold">Pertanyaan</span>
                <Badge variant="secondary" className={badgeClassName}>
                  Coba ingat
                </Badge>
              </span>
              <span className="mt-6 block size-14 text-(--flashcard-ink)" aria-hidden="true">
                <FlashcardDecoration theme={theme} />
              </span>
              <span className="relative z-1 mt-5 mb-8 block whitespace-pre-wrap font-display text-heading-sm font-extrabold leading-[1.4] wrap-anywhere">
                {card.front}
              </span>
              <span className={footerClassName}>
                <span>Pikirkan dulu, lalu balik.</span>
                <HugeiconsIcon icon={RepeatIcon} size={20} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span
                className="pointer-events-none absolute right-4 bottom-8 size-32 rotate-12 text-(--flashcard-ink) opacity-12"
                aria-hidden="true"
              >
                <FlashcardDecoration theme={theme} />
              </span>
            </span>
            <span
              className={`${faceClassName} bg-(--flashcard-answer) [transform:rotateY(180deg)]`}
              aria-hidden={!showBack}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-caption font-bold">Oh, jadi begitu!</span>
                <Badge variant="secondary" className={badgeClassName}>
                  Jawaban
                </Badge>
              </span>
              <span className="relative z-1 my-auto block whitespace-pre-wrap py-8 font-display text-subheading font-bold leading-[1.6] wrap-anywhere">
                {card.back}
              </span>
              <span
                className="pointer-events-none absolute right-4 bottom-8 size-16 rotate-12 text-(--flashcard-ink) opacity-8"
                aria-hidden="true"
              >
                <FlashcardDecoration theme={theme} />
              </span>
              <span className={footerClassName}>
                <span>Klik untuk lihat pertanyaan lagi.</span>
                <HugeiconsIcon icon={RepeatIcon} size={20} strokeWidth={1.5} aria-hidden="true" />
              </span>
            </span>
          </span>
        </button>
        {index > 0 ? (
          <Button
            aria-label="Kartu sebelumnya"
            className="absolute left-0 top-1/2 z-10 size-10 -translate-x-1/2 -translate-y-1/2 sm:size-12"
            onClick={() => move(index - 1)}
            size="icon"
            type="button"
            variant="secondary"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        ) : null}

        {index < activity.content.cards.length - 1 ? (
          <Button
            aria-label="Kartu berikutnya"
            className="absolute right-0 top-1/2 z-10 size-10 translate-x-1/2 -translate-y-1/2 sm:size-12"
            onClick={() => move(index + 1)}
            size="icon"
            type="button"
            variant="secondary"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <p className="text-center text-caption text-muted-foreground">
        Klik kartu atau tekan{" "}
        <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground shadow-[0_1px_0_var(--border)]">
          Spasi
        </kbd>{" "}
        saat kartu terpilih untuk membalik.
      </p>
    </article>
  );
}
