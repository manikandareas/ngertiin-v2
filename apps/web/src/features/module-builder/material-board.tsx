import { Add01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MAX_PDF_SIZE_BYTES } from "@ngertiin/contracts/api";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "../../components/ui/button";
import { menuContentClassName } from "../../components/ui/menu-styles";
import { SourceMenu } from "../sources/source-menu";
import { type MaterialAction, MaterialDialog } from "./material-dialog";
import { SortableMaterials } from "./sortable-materials";
import type { ModuleBuilderState } from "./use-module-builder";

export type MaterialLibrary = (menu: "context" | "dropdown") => ReactNode;

export function MaterialBoard({
  state,
  library,
}: {
  state: ModuleBuilderState;
  library: MaterialLibrary;
}) {
  const [action, setAction] = useState<MaterialAction | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const addButton = useRef<HTMLSpanElement>(null);
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
  const locked = state.busy || state.count >= 10;
  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild disabled={state.busy}>
          <section
            {...drop.getRootProps()}
            aria-label="Board materi"
            className={`bg-dot-grid bg-size-[16px_16px] bg-muted relative min-h-[380px] rounded-2xl border px-5 py-5 sm:min-h-[420px] sm:px-7 sm:py-6 ${drop.isDragActive ? "border-primary" : "border-muted"}`}
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
                    <DropdownMenu.Content
                      className={menuContentClassName}
                      align="end"
                      sideOffset={8}
                      onCloseAutoFocus={(event) => {
                        if (action) event.preventDefault();
                      }}
                    >
                      <SourceMenu menu="dropdown" library={library} open={open} disabled={locked} />
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </span>
            </div>
            {state.count ? (
              <SortableMaterials
                state={state}
                onSettings={(sourceId) => open({ kind: "settings", sourceId })}
              />
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center pb-5 text-center">
                <div className="relative mb-7 h-25 w-33" aria-hidden="true">
                  {[
                    "-translate-x-6.5 -rotate-17 bg-book-sage",
                    "-rotate-5 bg-book-blue",
                    "translate-x-7 rotate-12 bg-book-clay",
                  ].map((tone) => (
                    <span
                      key={tone}
                      className={`absolute bottom-0 left-8.5 h-22 w-16 rounded-[3px_6px_6px_3px] shadow-empty-book ${tone}`}
                    />
                  ))}
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
          <ContextMenu.Content className={menuContentClassName}>
            <SourceMenu menu="context" library={library} open={open} disabled={locked} />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {state.count
          ? "Geser pegangan di samping nomor untuk mengatur urutan prioritas materi."
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
