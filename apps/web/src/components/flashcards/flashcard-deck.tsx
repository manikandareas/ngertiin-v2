import { Check, MoveHorizontal, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { type CSSProperties, useId, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { FlashcardSticker, flashcardColors } from "./flashcard-sticker";

import { useFlashcardDrag } from "./use-flashcard-drag";

export type StudyCard = { id: string; front: string; back: string; decorationIndex?: number };

type Props = {
  cards: StudyCard[];
  busy?: boolean;
} & (
  | {
      marked: Record<string, boolean>;
      onMark: (id: string, understood: boolean) => Promise<boolean>;
    }
  | { marked?: never; onMark?: never }
);

/** Shared card station. Uncontrolled marks are a temporary, local study session. */
export function FlashcardDeck({ cards, marked, onMark, busy = false }: Props) {
  const contentId = useId();
  const gestureHintId = useId();
  const [position, setPosition] = useState(() => {
    const first = cards.findIndex((card) => marked?.[card.id] === undefined);
    return Math.max(0, first);
  });
  const [flipped, setFlipped] = useState(false);
  const [localMarks, setLocalMarks] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const completionRef = useRef<HTMLElement>(null);
  const marks = marked ?? localMarks;
  const card = cards[position];
  const focusCard = (scroll = true) => {
    requestAnimationFrame(() => {
      cardRef.current?.focus({ preventScroll: true });
      if (scroll) cardRef.current?.scrollIntoView({ block: "start" });
    });
  };
  const move = (next: number, scroll = true) => {
    setPosition(next);
    setFlipped(false);
    focusCard(scroll);
  };
  const drag = useFlashcardDrag({
    position,
    total: cards.length,
    disabled: busy || saving,
    onNavigate: (next) => move(next, false),
  });
  const locked = busy || saving || drag.transitioning;
  if (!card) return null;
  const decoration = card.decorationIndex ?? position;
  const mark = async (understood: boolean) => {
    if (!flipped || locked || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(false);
    try {
      if (onMark && !(await onMark(card.id, understood))) return;
      const nextMarks = { ...marks, [card.id]: understood };
      if (!onMark) setLocalMarks(nextMarks);
      const next = cards.findIndex((entry, i) => i > position && nextMarks[entry.id] === undefined);
      const remaining = cards.findIndex((entry) => nextMarks[entry.id] === undefined);
      if (next >= 0 || remaining >= 0) move(next >= 0 ? next : remaining);
      else if (!onMark) {
        setFinished(true);
        requestAnimationFrame(() => completionRef.current?.focus());
      }
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  if (finished) {
    const repeat = cards.filter((entry) => marks[entry.id] === false).length;
    return (
      <section
        ref={completionRef}
        tabIndex={-1}
        className="scroll-mt-20 rounded-3xl border bg-card p-6 outline-none sm:p-8"
        aria-live="polite"
        aria-label="Sesi kartu selesai"
      >
        <Check className="mb-4 size-8 text-success-foreground" />
        <h3 className="font-display text-xl font-bold">Semua kartu sudah kamu pelajari.</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {cards.length - repeat} kartu kamu tandai sudah paham
          {repeat ? `, ${repeat} perlu diulang.` : "."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Penanda ini hanya untuk sesi belajar ini.
        </p>
        <Button
          variant="outline"
          className="mt-5"
          onClick={() => {
            setLocalMarks({});
            setFinished(false);
            move(0);
          }}
        >
          <RotateCcw className="size-4" /> Pelajari lagi
        </Button>
      </section>
    );
  }

  return (
    <section aria-label="Kartu belajar" aria-busy={locked}>
      <div className="mb-3 flex min-h-9 items-center justify-between gap-3 text-xs text-muted-foreground">
        <span aria-live="polite">
          Kartu {position + 1} dari {cards.length}
        </span>
      </div>
      <div
        className="overflow-hidden rounded-[32px] border bg-card p-2"
        style={
          {
            "--study-card-color": flashcardColors[decoration % flashcardColors.length],
          } as CSSProperties
        }
      >
        <motion.button
          ref={cardRef}
          style={{ x: drag.x }}
          type="button"
          aria-label={flipped ? "Lihat pertanyaan lagi" : "Balik kartu untuk melihat jawaban"}
          aria-pressed={flipped}
          aria-describedby={`${contentId} ${gestureHintId}`}
          disabled={locked}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
          onLostPointerCapture={drag.onLostPointerCapture}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            if (locked || pending.current) return;
            const next = position + (event.key === "ArrowRight" ? 1 : -1);
            if (next >= 0 && next < cards.length) move(next);
          }}
          onClick={(event) => {
            if (event.detail !== 0 && drag.suppressClick.current) return;
            setFlipped(!flipped);
          }}
          className={cn(
            "flex min-h-87 w-full cursor-grab touch-pan-y touch-pinch-zoom scroll-mt-20 select-none active:cursor-grabbing flex-col rounded-3xl border-[3px] border-[var(--study-card-color)] p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-8",
            flipped
              ? "bg-card text-card-foreground shadow-[0_3px_0_var(--study-card-color)]"
              : "bg-[var(--study-card-color)] text-[#29253d]",
          )}
        >
          <span className="flex items-center justify-between gap-3 text-[11px] font-extrabold tracking-widest uppercase">
            <span>{flipped ? "Jawaban" : "Coba ingat"}</span>
            <span>
              {String(position + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
            </span>
          </span>
          <span className={cn("mt-3 flex shrink-0 justify-end", flipped ? "h-11" : "h-23")}>
            <FlashcardSticker
              index={decoration}
              className={flipped ? "h-11 w-12 -rotate-6" : "h-23 w-26 rotate-8"}
            />
          </span>
          <span
            id={contentId}
            className={cn(
              "my-auto block whitespace-pre-wrap py-5 font-display font-extrabold wrap-anywhere",
              flipped
                ? "text-xl leading-relaxed sm:text-2xl"
                : "text-2xl leading-snug sm:text-[32px]",
            )}
          >
            {flipped ? card.back : card.front}
          </span>
          <span className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span>{flipped ? "Lihat pertanyaan lagi" : "Klik untuk balik kartu"}</span>
            <RotateCcw className="size-5 shrink-0" />
          </span>
        </motion.button>
        <div className="flex min-h-19 items-center justify-between gap-2 px-1 pt-3 pb-1 sm:px-4">
          {flipped ? (
            <div className="grid w-full grid-cols-2 divide-x">
              <Button
                variant="ghost"
                disabled={locked}
                className="h-auto min-h-11 rounded-xl px-2 text-xs normal-case tracking-normal sm:text-sm"
                onClick={() => void mark(false)}
              >
                <RotateCcw className="size-4 shrink-0" /> Perlu diulang
              </Button>
              <Button
                variant="ghost"
                disabled={locked}
                className="h-auto min-h-11 rounded-xl px-2 text-xs normal-case tracking-normal sm:text-sm"
                onClick={() => void mark(true)}
              >
                <Check className="size-4 shrink-0" /> Sudah paham
              </Button>
            </div>
          ) : (
            <>
              <span className="text-xs text-muted-foreground sm:text-sm">Sudah punya jawaban?</span>
              <Button
                variant="ghost"
                disabled={locked}
                className="px-2 text-xs normal-case tracking-normal sm:text-sm"
                onClick={() => {
                  setFlipped(true);
                  focusCard();
                }}
              >
                Lihat jawaban <RotateCcw className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      <p
        id={gestureHintId}
        className="mt-4 flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground"
      >
        <MoveHorizontal className="size-4 shrink-0" aria-hidden="true" />
        <span>Geser kiri / kanan untuk pindah kartu.</span>
      </p>
      {saving ? (
        <p role="status" className="mt-3 text-center text-xs text-muted-foreground">
          Menyimpan pemahaman…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Penanda belum tersimpan. Coba lagi.
        </p>
      ) : null}
    </section>
  );
}
