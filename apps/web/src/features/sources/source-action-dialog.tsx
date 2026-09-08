import { patchSourceBodySchema } from "@ngertiin/contracts/api";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { DialogFrame } from "../../components/ui/dialog-frame";
import { Input } from "../../components/ui/input";
import { ApiProblemError } from "../../lib/api";
import { usePatchSource } from "./api/use-sources";
import type { SourceAction } from "./source-actions";

const actionCopy = {
  rename: {
    title: "Ubah judul",
    description: "Judul tampilan maksimal 200 karakter. Isi materi tetap sama.",
  },
  restore: { title: "Pulihkan materi", description: "Materi kembali tersedia untuk modul baru." },
  archive: {
    title: "Arsipkan materi",
    description:
      "Materi disembunyikan dari pilihan modul baru. File dan isi materi tetap disimpan; modul lama tetap tersedia.",
  },
};
type SourceActionDialogProps = {
  action: SourceAction;
  onClose: () => void;
  returnFocus: () => void;
};
export function SourceActionDialog({ action, onClose, returnFocus }: SourceActionDialogProps) {
  const [title, setTitle] = useState(action.source.title ?? action.source.originalFilename ?? "");
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const patch = usePatchSource();
  const archiveAction = action.source.archivedAt ? "restore" : "archive";
  const copy = actionCopy[action.kind === "rename" ? "rename" : archiveAction];
  const label = copy.title;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const parsed = patchSourceBodySchema.safeParse(
      action.kind === "rename" ? { title } : { archived: !action.source.archivedAt },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Periksa judul.");
      return;
    }
    lock.current = true;
    setError(null);
    try {
      await patch.mutateAsync({ id: action.source.id, input: parsed.data });
      onClose();
    } catch (error) {
      setError(
        error instanceof ApiProblemError
          ? error.problem.detail
          : "Perubahan belum tersimpan. Coba lagi.",
      );
    } finally {
      lock.current = false;
    }
  }
  return (
    <DialogFrame
      open
      title={copy.title}
      description={copy.description}
      onClose={onClose}
      returnFocus={returnFocus}
      busy={patch.isPending}
    >
      <form onSubmit={submit}>
        {action.kind === "rename" ? (
          <label htmlFor="source-rename-title" className="text-sm">
            Judul materi
            <Input
              id="source-rename-title"
              autoFocus
              value={title}
              disabled={patch.isPending}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={patch.isPending} onClick={onClose}>
            Batal
          </Button>
          <Button disabled={patch.isPending}>{patch.isPending ? "Menyimpan…" : label}</Button>
        </div>
      </form>
    </DialogFrame>
  );
}
