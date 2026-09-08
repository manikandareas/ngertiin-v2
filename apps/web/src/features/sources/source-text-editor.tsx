import { patchSourceBodySchema } from "@ngertiin/contracts/api";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { usePatchSource } from "./api/use-sources";

export function SourceTextEditor({
  id,
  text,
  onDirtyChange,
}: {
  id: string;
  text: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = usePatchSource();
  const value = draft ?? text;
  const dirty = draft !== null && draft !== text;
  const valid = patchSourceBodySchema.safeParse({ text: value }).success;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  let status = "Catatan ini bisa kamu edit.";
  if (dirty) status = "Ada perubahan yang belum disimpan.";
  else if (save.isSuccess) status = "Perubahan tersimpan.";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!dirty || !valid || save.isPending) return;
        save.mutate({ id, input: { text: value } }, { onSuccess: () => setDraft(null) });
      }}
      className="space-y-4"
    >
      <label htmlFor="source-text" className="text-sm font-semibold">
        Isi catatan
      </label>
      <textarea
        id="source-text"
        value={value}
        disabled={save.isPending}
        onChange={(event) => {
          setDraft(event.target.value);
          save.reset();
        }}
        className="min-h-[55dvh] w-full resize-y rounded-lg border border-border bg-background p-4 text-sm leading-7 focus-visible:outline-2 focus-visible:outline-ring"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!dirty || !valid || save.isPending}>
          {save.isPending ? "Menyimpan…" : "Simpan perubahan"}
        </Button>
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => {
              setDraft(null);
              save.reset();
            }}
          >
            Batal
          </Button>
        ) : null}
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      </div>
      {!valid ? (
        <p role="alert" className="text-sm text-destructive">
          Isi catatan wajib diisi, maksimal 100.000 karakter.
        </p>
      ) : null}
      {save.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Perubahan belum tersimpan. Coba lagi; tulisanmu tetap ada.
        </p>
      ) : null}
    </form>
  );
}
