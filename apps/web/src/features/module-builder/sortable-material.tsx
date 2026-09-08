import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GripVertical } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Button } from "../../components/ui/button";
import { SourceItemContent } from "../sources/source-item-content";
import type { Selection } from "./use-module-builder";

export function SortableMaterial({
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
      <div className="mb-3 flex items-center gap-2 px-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Urutkan materi ${index + 1}: ${item.source.title ?? "Materi tanpa judul"}`}
          disabled={disabled}
          className="flex h-8 touch-none items-center gap-1 rounded-sm px-1 text-xs font-semibold tabular-nums text-muted-foreground cursor-grab focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
        >
          <GripVertical size={16} aria-hidden="true" />
          {String(index + 1).padStart(2, "0")}
        </button>
        <span className="text-xs text-muted-foreground">
          {item.role === "primary"
            ? "Materi utama"
            : item.role === "reference"
              ? "Referensi"
              : "Pelengkap"}
          {item.selector ? ` · Halaman ${item.selector.pages.from}–${item.selector.pages.to}` : ""}
        </span>
      </div>
      <div className="px-1 pt-4 pb-2">
        <SourceItemContent
          compact
          source={item.source}
          onPreview={() => {
            window.open(`/sources/${item.source.id}`, "_blank", "noopener,noreferrer");
          }}
          disabled={disabled}
          actions={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-lg text-muted-foreground"
              disabled={disabled}
              aria-label={`Atur ${item.source.title ?? "materi"}`}
              onClick={onSettings}
            >
              <HugeiconsIcon icon={Settings04Icon} size={16} strokeWidth={1.5} aria-hidden="true" />
            </Button>
          }
        />
      </div>
    </li>
  );
}
