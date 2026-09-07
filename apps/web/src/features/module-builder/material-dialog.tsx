import { Cancel01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MAX_PDF_SIZE_BYTES } from "@ngertiin/contracts/api";
import { Dialog } from "radix-ui";
import { useDropzone } from "react-dropzone";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { UsageNotice } from "../usage/usage-notice";
import { useUsage } from "../usage/use-usage";
import { MaterialSettings } from "./material-settings";
import type { ModuleBuilderState } from "./use-module-builder";

export type MaterialAction =
  | { kind: "pdf" | "url" | "text" }
  | { kind: "settings"; sourceId: string };
const titles = {
  pdf: "Tambahkan PDF",
  url: "Tambahkan tautan",
  text: "Tambahkan teks",
  settings: "Atur materi",
};
const descriptions = {
  pdf: "Pilih dokumen yang ingin kamu pelajari. Maksimal 25 MiB per file.",
  url: "Gunakan halaman publik yang dapat dibuka tanpa login.",
  text: "Tempel catatan atau materi belajarmu. Maksimal 100.000 karakter.",
  settings: "Tentukan peran materi dan bagian yang ingin dipelajari.",
};

export function MaterialDialog({
  action,
  state,
  onClose,
  returnFocus,
}: {
  action: MaterialAction | null;
  state: ModuleBuilderState;
  onClose: () => void;
  returnFocus: () => void;
}) {
  const usage = useUsage();
  const quotaBlocked = !usage.data || usage.data.sources.remaining === 0;
  const drop = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    minSize: 1,
    maxSize: MAX_PDF_SIZE_BYTES,
    disabled: state.busy,
    onDropAccepted: ([file]) => {
      state.setFile(file);
      state.setSourceError(null);
    },
    onDropRejected: () => state.setSourceError("Pilih satu PDF berukuran maksimal 25 MiB."),
  });
  function discard() {
    if (action?.kind === "pdf") state.setFile(undefined);
    if (action?.kind === "url") state.setUrl("");
    if (action?.kind === "text") state.setText("");
    state.setTitle("");
    state.setSourceError(null);
    onClose();
  }
  return (
    <Dialog.Root
      open={!!action}
      onOpenChange={(open) => {
        if (!open && !state.busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/40" />
        <Dialog.Content
          className="builder-controls fixed top-1/2 left-1/2 z-61 max-h-[calc(100dvh-48px)] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-background p-7 text-foreground shadow-[0_20px_80px_#0002] motion-safe:animate-material-dialog-enter"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus();
          }}
          onEscapeKeyDown={(event) => {
            if (state.busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (state.busy) event.preventDefault();
          }}
        >
          {action ? (
            <>
              <header className="mb-6 pr-8">
                <Dialog.Title className="font-display text-xl font-bold">
                  {titles[action.kind]}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {descriptions[action.kind]}
                </Dialog.Description>
              </header>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={state.busy}
                  className="absolute right-4 top-4 size-8 p-0"
                  aria-label="Tutup dialog"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={18}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </Button>
              </Dialog.Close>
              {action.kind === "settings" ? (
                <fieldset disabled={state.busy} className="min-w-0 space-y-7">
                  <MaterialSettings state={state} sourceId={action.sourceId} />
                  {state.error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {state.error}
                    </p>
                  ) : null}
                  <div className="flex justify-between border-t border-muted pt-5">
                    <Button
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        const item = state.selected.find(
                          (item) => item.source.id === action.sourceId,
                        );
                        if (item) state.toggle(item.source);
                        onClose();
                      }}
                    >
                      Hapus materi
                    </Button>
                    <Button onClick={onClose}>Selesai</Button>
                  </div>
                </fieldset>
              ) : (
                <form
                  noValidate
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (quotaBlocked) return;
                    if (await state.add(action.kind)) onClose();
                  }}
                >
                  <fieldset disabled={state.busy} className="min-w-0 space-y-5">
                    <label htmlFor="material-title" className="block space-y-2 text-sm font-medium">
                      Judul materi <span className="text-muted-foreground">(opsional)</span>
                      <Input
                        id="material-title"
                        value={state.title}
                        onChange={(e) => state.setTitle(e.target.value)}
                        placeholder="Contoh: Mengenal sistem tata surya"
                      />
                    </label>
                    {action.kind === "pdf" ? (
                      <div
                        {...drop.getRootProps()}
                        className={`cursor-pointer rounded-xl border border-dashed px-5 py-8 text-center focus-visible:outline-2 focus-visible:outline-ring ${drop.isDragActive ? "border-primary bg-secondary" : "border-input bg-muted/30"}`}
                      >
                        <input {...drop.getInputProps()} aria-label="Pilih PDF" />
                        <HugeiconsIcon
                          icon={Upload01Icon}
                          size={28}
                          strokeWidth={1.5}
                          className="mx-auto mb-3 text-link"
                          aria-hidden="true"
                        />
                        <p className="break-words text-sm font-medium">
                          {state.file?.name ?? "Pilih atau letakkan PDF di sini"}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {state.file ? "Klik untuk mengganti file" : "Satu PDF hingga 25 MiB"}
                        </p>
                      </div>
                    ) : action.kind === "url" ? (
                      <label htmlFor="material-url" className="block space-y-2 text-sm font-medium">
                        Tautan halaman
                        <Input
                          id="material-url"
                          type="url"
                          value={state.url}
                          onChange={(e) => state.setUrl(e.target.value)}
                          placeholder="https://contoh.id/artikel"
                        />
                      </label>
                    ) : (
                      <label
                        htmlFor="material-text"
                        className="block space-y-2 text-sm font-medium"
                      >
                        Isi materi
                        <Textarea
                          id="material-text"
                          rows={7}
                          value={state.text}
                          onChange={(e) => state.setText(e.target.value)}
                          placeholder="Tempel materi atau catatanmu di sini…"
                        />
                      </label>
                    )}
                    {state.sourceError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {state.sourceError}
                      </p>
                    ) : null}
                    <UsageNotice category="sources" />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-muted pt-5">
                      <Button type="button" variant="ghost" onClick={discard}>
                        Buang isian
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          quotaBlocked ||
                          state.count >= 10 ||
                          (action.kind === "pdf"
                            ? !state.file
                            : action.kind === "url"
                              ? !state.url.trim()
                              : !state.text.trim())
                        }
                      >
                        {state.busy ? "Menambahkan…" : "Tambahkan ke board"}
                      </Button>
                    </div>
                  </fieldset>
                </form>
              )}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
