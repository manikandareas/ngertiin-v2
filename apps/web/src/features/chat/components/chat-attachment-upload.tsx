import {
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_FILES,
  CHAT_ATTACHMENT_TOTAL_BYTES,
  type ChatAttachment,
  chatAttachmentNote,
  chatAttachmentTypes,
} from "@ngertiin/contracts/api";
import { Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { fileChipClassName } from "../../../components/ui/file-chip";
import type { TokenResolver } from "../../../lib/api";
import { chatApi } from "../api/chat-api";
import { ChatFileBadge } from "./chat-file-badge";

type Upload = { key: string; file: File; status: "uploading" | "failed"; error?: string };
export function useAttachmentUpload(
  attachments: ChatAttachment[],
  onChange: (items: ChatAttachment[]) => void,
  getToken: TokenResolver,
  disabled: boolean,
) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [removing, setRemoving] = useState<string[]>([]);
  const [error, setError] = useState("");
  const current = useRef(attachments);
  current.current = attachments;
  const callback = useRef(onChange);
  callback.current = onChange;
  const pending = useRef<Upload[]>([]);
  const previews = useRef(new Map<string, string>());
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const url of previews.current.values()) URL.revokeObjectURL(url);
    };
  }, []);
  function update(items: Upload[]) {
    pending.current = items;
    if (alive.current) setUploads(items);
  }
  async function upload(item: Upload) {
    update(
      pending.current.map((value) =>
        value.key === item.key ? { ...value, status: "uploading", error: undefined } : value,
      ),
    );
    try {
      const attachment = await chatApi(getToken).upload(item.file);
      if (!alive.current || !pending.current.some((value) => value.key === item.key)) {
        await chatApi(getToken).removeAttachment(attachment.id);
        return;
      }
      if (item.file.type.startsWith("image/"))
        previews.current.set(attachment.id, URL.createObjectURL(item.file));
      const next = [...current.current, attachment];
      current.current = next;
      callback.current(next);
      update(pending.current.filter((value) => value.key !== item.key));
    } catch (error) {
      update(
        pending.current.map((value) =>
          value.key === item.key
            ? {
                ...value,
                status: "failed",
                error: error instanceof Error ? error.message : "Upload gagal",
              }
            : value,
        ),
      );
    }
  }
  function add(files: File[]) {
    if (disabled || !files.length) return;
    setError("");
    const count = current.current.length + pending.current.length + files.length;
    const bytes =
      current.current.reduce((sum, item) => sum + item.size, 0) +
      pending.current.reduce((sum, item) => sum + item.file.size, 0) +
      files.reduce((sum, file) => sum + file.size, 0);
    if (count > CHAT_ATTACHMENT_MAX_FILES || bytes > CHAT_ATTACHMENT_TOTAL_BYTES) {
      setError("Maksimal 5 file dengan total 25 MB per pesan.");
      return;
    }
    if (
      files.some(
        (file) =>
          !file.size ||
          file.size > CHAT_ATTACHMENT_MAX_BYTES ||
          !Object.hasOwn(chatAttachmentTypes, file.name.split(".").at(-1)?.toLowerCase() ?? ""),
      )
    ) {
      setError("Format tidak didukung atau file melebihi 10 MB.");
      return;
    }
    const items: Upload[] = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: "uploading",
    }));
    update([...pending.current, ...items]);
    for (const item of items) void upload(item);
  }
  async function removeAttachment(id: string): Promise<void> {
    setRemoving((ids) => [...ids, id]);
    try {
      await chatApi(getToken).removeAttachment(id);
      const next = current.current.filter((value) => value.id !== id);
      current.current = next;
      callback.current(next);
      const url = previews.current.get(id);
      if (url) URL.revokeObjectURL(url);
      previews.current.delete(id);
    } catch {
      setError("Lampiran belum dapat dihapus. Coba lagi.");
    } finally {
      setRemoving((ids) => ids.filter((removingId) => removingId !== id));
    }
  }

  const content = (
    <>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        accept={Object.keys(chatAttachmentTypes)
          .map((ext) => `.${ext}`)
          .join(",")}
        onChange={(event) => {
          add(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {attachments.length || uploads.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((item) => (
            <div key={item.id} className="min-w-0 max-w-full text-xs">
              {previews.current.get(item.id) ? (
                <img
                  src={previews.current.get(item.id)}
                  alt={item.filename}
                  className="mb-1 h-16 max-w-40 rounded object-contain"
                />
              ) : null}
              <div className={fileChipClassName}>
                <ChatFileBadge filename={item.filename} />
                <span className="min-w-0 max-w-48 truncate" title={item.filename}>
                  {item.filename}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 cursor-pointer rounded-full hover:bg-background disabled:cursor-not-allowed"
                  disabled={disabled || removing.includes(item.id)}
                  aria-label={`Hapus ${item.filename}`}
                  onClick={() => void removeAttachment(item.id)}
                >
                  <X />
                </Button>
              </div>
              {chatAttachmentNote(item.filename) ? (
                <p className="mt-1 max-w-64 px-2 text-muted-foreground">
                  {chatAttachmentNote(item.filename)}
                </p>
              ) : null}
            </div>
          ))}
          {uploads.map((item) => (
            <div
              key={item.key}
              className="max-w-full rounded-2xl border bg-zinc-200 p-2 text-xs dark:bg-zinc-800"
              role="status"
            >
              <div className="flex min-w-0 items-center gap-2">
                <ChatFileBadge filename={item.file.name} />
                <span className="min-w-0 max-w-48 truncate">{item.file.name}</span>
              </div>
              <p>{item.status === "uploading" ? "Mengunggah…" : item.error}</p>
              {item.status === "failed" ? (
                <button type="button" className="mr-3 underline" onClick={() => void upload(item)}>
                  Coba ulang
                </button>
              ) : null}
              <button
                type="button"
                className="underline"
                onClick={() => update(pending.current.filter((value) => value.key !== item.key))}
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
  const button = (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
      aria-label="Lampirkan file"
      title="Maksimal 5 file, 10 MB per file, total 25 MB"
      disabled={disabled}
      onClick={() => input.current?.click()}
    >
      <Paperclip />
    </Button>
  );
  return { add, content, button, pending: uploads.length > 0 || removing.length > 0 };
}
