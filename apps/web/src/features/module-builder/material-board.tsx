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
import { Add01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MAX_PDF_SIZE_BYTES } from "@ngertiin/contracts/api";
import { useReducedMotion } from "motion/react";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "../../components/ui/button";
import { BookCover, MaterialBook } from "./material-book";
import { type MaterialAction, MaterialDialog } from "./material-dialog";
import { MaterialMenu } from "./material-menu";
import type { ModuleBuilderState } from "./use-module-builder";
import "./material-board.css";

export type MaterialLibrary = (menu: "context" | "dropdown") => ReactNode;

export function MaterialBoard({
  state,
  library,
}: {
  state: ModuleBuilderState;
  library: MaterialLibrary;
}) {
  const [action, setAction] = useState<MaterialAction | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const addButton = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function open(next: MaterialAction) {
    state.setSourceError(null);
    setDropError(null);
    setAction(next);
  }
  const drop = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_PDF_SIZE_BYTES,
    minSize: 1,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled: state.busy || !!action || state.count >= 10,
    onDropAccepted: ([file]) => {
      if (file) {
        state.setFile(file);
        open({ kind: "pdf" });
      }
    },
    onDropRejected: () =>
      setDropError(
        "Letakkan satu PDF berukuran maksimal 25 MiB. Kamu bisa menambahkan hingga 10 materi.",
      ),
  });
  const active = state.selected.find((item) => item.source.id === activeId);
  const locked = state.busy || state.count >= 10;
  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild disabled={state.busy}>
          <section
            {...drop.getRootProps()}
            aria-label="Board materi"
            className={`material-board relative min-h-[380px] rounded-2xl border border-muted px-5 py-5 sm:min-h-[420px] sm:px-7 sm:py-6 ${drop.isDragActive ? "material-board-dropping" : ""}`}
          >
            <input {...drop.getInputProps()} aria-label="Letakkan PDF pada board" />
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {state.count ? `${state.count} dari 10 materi` : "Ruang untuk rasa penasaranmu"}
              </span>
              <span ref={addButton}>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={state.busy}
                    >
                      <HugeiconsIcon
                        icon={Add01Icon}
                        size={16}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      Tambah materi
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="material-menu" align="end" sideOffset={8}>
                      <MaterialMenu
                        menu="dropdown"
                        library={library}
                        open={open}
                        disabled={locked}
                      />
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </span>
            </div>
            {state.count ? (
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
                      "Tekan spasi untuk mengangkat buku, tombol panah untuk memindahkan, spasi untuk meletakkan, dan Escape untuk membatalkan.",
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
                  <ol className="material-books grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 sm:gap-x-8">
                    {state.selected.map((item, index) => (
                      <MaterialBook
                        key={item.source.id}
                        item={item}
                        index={index}
                        disabled={state.busy}
                        onSettings={() => open({ kind: "settings", sourceId: item.source.id })}
                      />
                    ))}
                  </ol>
                </SortableContext>
                <DragOverlay
                  dropAnimation={reducedMotion ? null : { duration: 180, easing: "ease-out" }}
                >
                  {active ? (
                    <div className="material-book-lift">
                      <BookCover item={active} />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center pb-5 text-center">
                <div className="empty-books mb-7" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <p className="text-sm font-semibold">Bahan belajar, bertemu di sini.</p>
                <p className="mt-2 max-w-64 text-xs leading-5 text-muted-foreground">
                  Letakkan PDF di board, atau klik kanan untuk menambahkan materi lainnya.
                </p>
              </div>
            )}
            {drop.isDragActive ? (
              <div className="pointer-events-none absolute inset-0 z-20 grid place-content-center rounded-2xl border-2 border-dashed border-primary bg-background/95 text-center">
                <HugeiconsIcon
                  icon={Upload01Icon}
                  size={32}
                  strokeWidth={1.5}
                  className="mx-auto mb-3 text-link"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-link">Lepaskan PDF di sini</p>
                <p className="mt-2 text-xs text-muted-foreground">Satu file hingga 25 MiB</p>
              </div>
            ) : null}
          </section>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="material-menu">
            <MaterialMenu menu="context" library={library} open={open} disabled={locked} />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {state.count
          ? "Geser buku untuk mengatur urutan. Nomor buku menjadi prioritas materi."
          : "PDF hingga 25 MiB per file · Maksimal 10 materi"}
      </p>
      {dropError || (!action && state.sourceError) ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {dropError || state.sourceError}
        </p>
      ) : null}
      <MaterialDialog
        action={action}
        state={state}
        onClose={() => setAction(null)}
        returnFocus={() => addButton.current?.querySelector("button")?.focus()}
      />
    </>
  );
}
