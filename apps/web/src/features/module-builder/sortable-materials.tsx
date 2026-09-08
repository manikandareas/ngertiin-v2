import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useReducedMotion } from "motion/react";
import { useState } from "react";
import { SourcePaper } from "../sources/source-paper";
import { SortableMaterial } from "./sortable-material";
import type { ModuleBuilderState } from "./use-module-builder";

export function SortableMaterials({
  state,
  onSettings,
}: {
  state: Pick<ModuleBuilderState, "selected" | "busy" | "setSelected">;
  onSettings: (sourceId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const active = state.selected.find((item) => item.source.id === activeId);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active, over }) => {
        setActiveId(null);
        if (!over || active.id === over.id || state.busy) return;
        state.setSelected((items) => {
          const from = items.findIndex((item) => item.source.id === active.id);
          const to = items.findIndex((item) => item.source.id === over.id);
          return from < 0 || to < 0 ? items : arrayMove(items, from, to);
        });
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Tekan spasi untuk mengangkat materi, tombol panah untuk memindahkan, spasi untuk meletakkan, dan Escape untuk membatalkan.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Materi ${state.selected.findIndex((item) => item.source.id === active.id) + 1} diangkat.`,
          onDragOver: ({ over }) =>
            over
              ? `Posisi ${state.selected.findIndex((item) => item.source.id === over.id) + 1}.`
              : "Di luar board.",
          onDragEnd: ({ over }) =>
            over
              ? `Materi diletakkan pada posisi ${state.selected.findIndex((item) => item.source.id === over.id) + 1}.`
              : "Urutan tidak berubah.",
          onDragCancel: () => "Pemindahan dibatalkan.",
        },
      }}
    >
      <SortableContext
        items={state.selected.map((item) => item.source.id)}
        strategy={rectSortingStrategy}
      >
        <ol className="grid grid-cols-1 gap-x-4 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {state.selected.map((item, index) => (
            <SortableMaterial
              key={item.source.id}
              item={item}
              index={index}
              disabled={state.busy}
              onSettings={() => onSettings(item.source.id)}
            />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay dropAnimation={reducedMotion ? null : { duration: 180, easing: "ease-out" }}>
        {active ? (
          <div className="pointer-events-none -rotate-3 scale-104 px-1 pt-4" aria-hidden="true">
            <SourcePaper compact source={active.source} onPreview={() => {}} disabled />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
