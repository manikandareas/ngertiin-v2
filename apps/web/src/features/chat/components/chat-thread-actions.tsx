import { Delete02Icon, MoreHorizontalIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ChatThread, chatTitleSchema } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { DialogFrame } from "../../../components/ui/dialog-frame";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Input } from "../../../components/ui/input";
import { ApiProblemError } from "../../../lib/api";
import type { chatApi } from "../api/chat-api";

type ChatThreadActionsProps = {
  thread: ChatThread;
  api: ReturnType<typeof chatApi>;
  root: readonly unknown[];
  onDeleted?: () => void;
  triggerIcon?: ReactNode;
};

export function ChatThreadActions({
  thread,
  api,
  root,
  onDeleted,
  triggerIcon,
}: ChatThreadActionsProps) {
  const client = useQueryClient();
  const trigger = useRef<HTMLSpanElement>(null);
  const [action, setAction] = useState<"rename" | "delete" | null>(null);
  const [title, setTitle] = useState(thread.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!action || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "rename") {
        const parsed = chatTitleSchema.safeParse(title);
        if (!parsed.success) {
          setError("Judul harus berisi 1–120 karakter.");
          return;
        }
        const updated = await api.rename(thread.id, parsed.data);
        client.setQueryData([...root, "thread", thread.id], updated);
      } else {
        await api.remove(thread.id);
        client.removeQueries({ queryKey: [...root, "thread", thread.id], exact: true });
        client.removeQueries({ queryKey: [...root, "session", thread.id], exact: true });
        onDeleted?.();
      }
      setAction(null);
      void client.invalidateQueries({ queryKey: root });
    } catch (e) {
      setError(e instanceof ApiProblemError ? e.problem.detail : "Perubahan belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }
  const submitLabel = busy
    ? "Menyimpan…"
    : { rename: "Simpan", delete: "Hapus" }[action ?? "delete"];
  return (
    <>
      <DropdownMenu>
        <span ref={trigger}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`Aksi percakapan ${thread.title}`}
            >
              {triggerIcon ?? (
                <HugeiconsIcon
                  icon={MoreHorizontalIcon}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="size-4"
                />
              )}
            </Button>
          </DropdownMenuTrigger>
        </span>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setTitle(thread.title);
              setError(null);
              setAction("rename");
            }}
          >
            <HugeiconsIcon
              icon={PencilEdit01Icon}
              strokeWidth={1.5}
              aria-hidden="true"
              className="size-4"
            />{" "}
            Ubah judul
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Boolean(thread.activeRunId)}
            onSelect={() => {
              setError(null);
              setAction("delete");
            }}
          >
            <HugeiconsIcon
              icon={Delete02Icon}
              strokeWidth={1.5}
              aria-hidden="true"
              className="size-4"
            />{" "}
            Hapus percakapan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogFrame
        open={action !== null}
        title={action === "rename" ? "Ubah judul percakapan" : "Hapus percakapan?"}
        description={
          action === "rename"
            ? "Beri judul agar mudah ditemukan kembali."
            : "Percakapan yang dihapus tidak akan muncul lagi."
        }
        busy={busy}
        onClose={() => setAction(null)}
        returnFocus={() => trigger.current?.querySelector("button")?.focus()}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {action === "rename" ? (
            <Input
              aria-label="Judul percakapan"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          ) : (
            <p className="break-words text-sm">{thread.title}</p>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setAction(null)}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={busy}
              variant={action === "delete" ? "destructive" : "default"}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogFrame>
    </>
  );
}
