import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PracticeAnswer, PracticeDetail } from "@ngertiin/contracts/api";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../../components/app-shell";
import { FlashcardDeck } from "../../../components/flashcards/flashcard-deck";
import { ThemeToggle } from "../../../components/theme-toggle";
import { Button } from "../../../components/ui/button";

type Props = {
  practice: PracticeDetail;
  attemptId: string;
  answers: Record<string, PracticeAnswer>;
  canAnswer: boolean;
  busy: boolean;
  unsaved: boolean;
  onMark: (id: string, understood: boolean) => Promise<boolean>;
  children: ReactNode;
};

export function PracticeFlashcardAttempt({
  practice,
  attemptId,
  answers,
  canAnswer,
  busy,
  unsaved,
  onMark,
  children,
}: Props) {
  const cards = practice.items.flatMap((item, index) =>
    item.content.type === "flashcard"
      ? [
          {
            id: item.id,
            front: item.content.front,
            back: item.content.back,
            decorationIndex: index,
          },
        ]
      : [],
  );
  const marked = Object.fromEntries(
    Object.entries(answers).flatMap(([id, answer]) =>
      answer.type === "flashcard" ? [[id, answer.understood]] : [],
    ),
  );
  const answered = cards.filter((card) => marked[card.id] !== undefined).length;
  return (
    <AppShell workspace unsavedChanges={unsaved}>
      <header className="relative shrink-0 border-b bg-background px-5 sm:px-8">
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="size-9 shrink-0 rounded-full">
            <Link
              to={`/modules/${practice.moduleId}/practice/${practice.id}`}
              aria-label="Kembali ke detail latihan"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold sm:text-center sm:text-base">
            {practice.title}
          </h1>
          {canAnswer ? (
            <span className="shrink-0 text-xs text-muted-foreground" role="status">
              {answered}/{cards.length} <span className="hidden sm:inline">ditandai</span>
            </span>
          ) : null}
          <ThemeToggle />
        </div>
        {canAnswer ? (
          <progress
            className="learning-progress absolute inset-x-0 bottom-0 h-[3px]! rounded-none!"
            aria-label="Kartu ditandai"
            max={Math.max(1, cards.length)}
            value={answered}
          />
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-[864px] px-5 py-7 sm:px-8 sm:py-10">
          {canAnswer ? (
            <>
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Flashcard
              </p>
              <h2 className="mt-2 mb-3 font-display text-xl font-bold sm:text-2xl">
                Satu kartu, satu pemahaman.
              </h2>
              <FlashcardDeck
                key={attemptId}
                cards={cards}
                marked={marked}
                onMark={onMark}
                busy={busy}
              />
            </>
          ) : null}
          {children}
        </div>
      </div>
    </AppShell>
  );
}
