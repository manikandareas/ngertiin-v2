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
        className="group/book block touch-pan-y select-none [-webkit-user-select:none] w-full cursor-grab rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:cursor-grabbing"
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

const bookTones = [
  "bg-book-blue text-book-blue-ink",
  "bg-book-sage text-book-sage-ink",
  "bg-book-clay text-book-clay-ink",
  "bg-book-lilac text-book-lilac-ink",
];

export function BookCover({ item }: { item: Selection }) {
  const tone = [...item.source.id].reduce((value, letter) => value + letter.charCodeAt(0), 0) % 4;
  return (
    <span className="relative isolate block aspect-3/4 w-full">
      <span
        className="absolute top-[5px] -right-1 -bottom-[3px] left-2 rounded-[2px_5px_5px_2px] border border-book-page-edge bg-book-pages shadow-book-pages"
        aria-hidden="true"
      />
      <span
        className={`absolute inset-x-0 top-0 bottom-[5px] flex origin-left flex-col overflow-hidden rounded-[3px_7px_7px_3px] py-4.5 pr-3.5 pl-5.5 shadow-book-cover motion-safe:transition-transform motion-safe:duration-180 motion-safe:ease-out motion-safe:group-hover/book:[transform:perspective(700px)_rotateY(-7deg)] max-[380px]:py-3.5 max-[380px]:pr-2.5 max-[380px]:pl-4.5 ${bookTones[tone]}`}
      >
        <span
          className="absolute inset-y-0 left-0 w-3 border-r border-black/7 bg-book-binding"
          aria-hidden="true"
        />
        <span className="text-[9px] font-semibold tracking-[0.04em]">
          {item.source.type === "text"
            ? "Catatan"
            : item.source.type === "url"
              ? "Tautan"
              : "Dokumen PDF"}
        </span>
        <span className="mt-5.5 line-clamp-4 font-display text-base font-extrabold leading-[1.35] [overflow-wrap:anywhere] max-[380px]:mt-3.5 max-[380px]:text-sm">
          {item.source.title ?? "Materi tanpa judul"}
        </span>
        <span className="mt-auto block h-px w-7 bg-current opacity-30" aria-hidden="true" />
        <span className="mt-2.25 text-[9px] leading-[1.4]">
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
