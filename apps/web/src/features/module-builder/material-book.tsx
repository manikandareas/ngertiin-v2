import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useReducedMotion } from "motion/react";
import { Button } from "../../components/ui/button";
import { statusLabels } from "./source-presentation";
import type { Selection } from "./use-module-builder";

export function MaterialBook({
  item,
  index,
  disabled,
  onSettings,
}: {
  item: Selection;
  index: number;
  disabled: boolean;
  onSettings: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.source.id,
    disabled,
    transition: reducedMotion ? null : { duration: 180, easing: "ease-out" },
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
      }}
      className="min-w-0"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-muted-foreground"
          disabled={disabled}
          aria-label={`Atur ${item.source.title ?? "materi"}`}
          onClick={onSettings}
        >
          <HugeiconsIcon icon={Settings04Icon} size={16} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      </div>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Urutkan materi ${index + 1}: ${item.source.title ?? "Materi tanpa judul"}`}
        disabled={disabled}
        className="material-book-handle block w-full cursor-grab rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:cursor-grabbing"
      >
        <BookCover item={item} />
      </button>
      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
        <span
          aria-hidden="true"
          className={`mt-1 size-1.5 shrink-0 rounded-full ${item.source.status === "ready" ? "bg-success" : item.source.status === "failed" ? "bg-destructive" : "bg-primary motion-safe:animate-pulse"}`}
        />
        {statusLabels[item.source.status]}
      </p>
    </li>
  );
}

export function BookCover({ item }: { item: Selection }) {
  const tone = [...item.source.id].reduce((value, letter) => value + letter.charCodeAt(0), 0) % 4;
  return (
    <span className="material-book" data-tone={tone}>
      <span className="material-book-pages" aria-hidden="true" />
      <span className="material-book-cover">
        <span className="material-book-binding" aria-hidden="true" />
        <span className="material-book-type">
          {item.source.type === "text"
            ? "Catatan"
            : item.source.type === "url"
              ? "Tautan"
              : "Dokumen PDF"}
        </span>
        <span className="material-book-title">{item.source.title ?? "Materi tanpa judul"}</span>
        <span className="material-book-rule" aria-hidden="true" />
        <span className="material-book-caption">
          {item.selector
            ? `Halaman ${item.selector.pages.from}–${item.selector.pages.to}`
            : item.role === "primary"
              ? "Materi utama"
              : item.role === "reference"
                ? "Referensi"
                : "Pelengkap"}
        </span>
      </span>
    </span>
  );
}
