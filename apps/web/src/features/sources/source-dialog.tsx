import { Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MAX_PDF_SIZE_BYTES, type SourceType } from "@ngertiin/contracts/api";
import { useDropzone } from "react-dropzone";
import { Button } from "../../components/ui/button";
import { DialogFrame } from "../../components/ui/dialog-frame";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { UsageNotice } from "../usage/usage-notice";
import { useUsage } from "../usage/use-usage";
import type { SourceFormState } from "./use-source-form";
export type AddSourceAction = { kind: SourceType };
const titles = { pdf: "Tambahkan PDF", url: "Tambahkan tautan", text: "Tambahkan teks" };
const descriptions = {
  pdf: "Pilih dokumen yang ingin kamu pelajari. Maksimal 25 MiB per file.",
  url: "Gunakan halaman publik yang dapat dibuka tanpa login.",
  text: "Tempel catatan atau materi belajarmu. Maksimal 100.000 karakter.",
};
type SourceDialogProps = {
  action: AddSourceAction | null;
  state: SourceFormState;
  onClose: () => void;
  returnFocus: () => void;
  limitReached?: boolean;
  submitLabel?: string;
};
export function SourceDialog({
  action,
  state,
  onClose,
  returnFocus,
  limitReached = false,
  submitLabel = "Tambahkan materi",
}: SourceDialogProps) {
  const kind = action?.kind ?? "text";
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
    if (kind === "pdf") state.setFile(undefined);
    if (kind === "url") state.setUrl("");
    if (kind === "text") state.setText("");
    state.setTitle("");
    state.setSourceError(null);
    onClose();
  }
  return (
    <DialogFrame
      open={!!action}
      title={titles[kind]}
      description={descriptions[kind]}
      busy={state.busy}
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (quotaBlocked) return;
          if (await state.add(kind)) onClose();
        }}
      >
        <fieldset disabled={state.busy} className="min-w-0 space-y-5">
          <label htmlFor="material-title" className="block space-y-2 text-sm font-medium">
            Judul materi <span className="text-muted-foreground">(opsional)</span>
            <Input
              className="h-11 rounded-xl border sm:text-sm"
              id="material-title"
              value={state.title}
              onChange={(e) => state.setTitle(e.target.value)}
              placeholder="Contoh: Mengenal sistem tata surya"
            />
          </label>
          {kind === "pdf" ? (
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
          ) : kind === "url" ? (
            <label htmlFor="material-url" className="block space-y-2 text-sm font-medium">
              Tautan halaman
              <Input
                className="h-11 rounded-xl border sm:text-sm"
                id="material-url"
                type="url"
                value={state.url}
                onChange={(e) => state.setUrl(e.target.value)}
                placeholder="https://contoh.id/artikel"
              />
            </label>
          ) : (
            <label htmlFor="material-text" className="block space-y-2 text-sm font-medium">
              Isi materi
              <Textarea
                className="rounded-xl border px-4 py-3.5 leading-7 sm:text-sm"
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
            <Button
              className="font-semibold normal-case tracking-normal"
              type="button"
              variant="ghost"
              onClick={discard}
            >
              Buang isian
            </Button>
            <Button
              className="font-semibold normal-case tracking-normal"
              type="submit"
              disabled={
                quotaBlocked ||
                limitReached ||
                (kind === "pdf"
                  ? !state.file
                  : kind === "url"
                    ? !state.url.trim()
                    : !state.text.trim())
              }
            >
              {state.busy ? "Menambahkan…" : submitLabel}
            </Button>
          </div>
        </fieldset>
      </form>
    </DialogFrame>
  );
}
