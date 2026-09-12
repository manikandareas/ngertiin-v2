import { type ChatPageContext, type ChatThread, chatTitleSchema } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { DialogFrame } from "../../../components/ui/dialog-frame";
import { Input } from "../../../components/ui/input";
import { isClerkConfigured } from "../../../config";
import { ApiProblemError } from "../../../lib/api";
import { useModuleChat } from "../use-module-chat";
import { ChatComposer } from "./chat-composer";
import { ChatConversation } from "./chat-conversation";
import { ChatHeader } from "./chat-header";
import { ChatPanel } from "./chat-panel";
import { ChatWelcome } from "./chat-welcome";

export function ChatSidebar(props: {
  moduleId: string;
  pageContext: ChatPageContext;
  contextLabel?: string;
}) {
  return isClerkConfigured ? <ConnectedChatSidebar key={props.moduleId} {...props} /> : null;
}
function ConnectedChatSidebar({
  moduleId,
  pageContext,
  contextLabel = "Modul ini",
}: {
  moduleId: string;
  pageContext: ChatPageContext;
  contextLabel?: string;
}) {
  const chat = useModuleChat(moduleId);
  const [newDraft, setNewDraft] = useState("");
  const [initialMessage, setInitialMessage] = useState<{ threadId: string; text: string } | null>(
    null,
  );
  const creating = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    thread: ChatThread;
    action: "rename" | "delete";
  } | null>(null);
  const [title, setTitle] = useState("");
  const selected = useQuery({
    queryKey: [...chat.root, "thread", chat.selectedId],
    queryFn: () => chat.api.get(chat.selectedId ?? ""),
    enabled: Boolean(chat.selectedId && chat.open),
    refetchInterval: chat.open ? 2000 : false,
  });
  const current = selected.data ?? chat.list.find((t) => t.id === chat.selectedId);
  async function create(text = "") {
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    setError(null);
    try {
      const thread = await chat.api.create();
      setInitialMessage(text.trim() ? { threadId: thread.id, text: text.trim() } : null);
      chat.select(thread.id);
      setNewDraft("");
      await chat.refresh();
    } catch (e) {
      setError(e instanceof ApiProblemError ? e.problem.detail : "Percakapan belum dapat dibuat.");
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.action === "rename") {
        const parsed = chatTitleSchema.safeParse(title);
        if (!parsed.success) {
          setError("Judul harus berisi 1–120 karakter.");
          return;
        }
        await chat.api.rename(editing.thread.id, parsed.data);
      } else {
        await chat.api.remove(editing.thread.id);
        if (chat.selectedId === editing.thread.id) chat.select(null);
      }
      setEditing(null);
      await chat.refresh();
    } catch (e) {
      setError(e instanceof ApiProblemError ? e.problem.detail : "Perubahan belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <>
      <ChatHeader
        chat={chat}
        title={current?.title ?? "Percakapan baru"}
        busy={busy}
        onCreate={() => void create()}
        onEdit={(thread, action) => {
          setTitle(thread.title);
          setEditing({ thread, action });
        }}
      />
      {error && !editing ? (
        <p role="alert" className="px-5 py-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {chat.threads.isError || selected.isError ? (
        <div className="p-5 text-sm">
          <p>Chat belum dapat dimuat.</p>
          <Button variant="link" onClick={() => void chat.refresh()}>
            Coba lagi
          </Button>
        </div>
      ) : current ? (
        <ChatConversation
          key={current.id}
          thread={current}
          api={chat.api}
          root={chat.root}
          getToken={chat.getToken}
          moduleId={moduleId}
          pageContext={pageContext}
          contextLabel={contextLabel}
          initialMessage={initialMessage?.threadId === current.id ? initialMessage.text : undefined}
          onInitialMessageConsumed={() => setInitialMessage(null)}
        />
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-4">
            <ChatWelcome
              disabled={busy || chat.threads.isPending}
              onSuggest={(text) => void create(text)}
            />
          </div>
          <ChatComposer
            draft={newDraft}
            onDraftChange={setNewDraft}
            onSend={() => void create(newDraft)}
            contextLabel={contextLabel}
            disabled={busy || chat.threads.isPending}
          />
          {busy ? (
            <p role="status" className="px-5 pb-3 text-xs text-muted-foreground">
              Membuka percakapan…
            </p>
          ) : null}
        </>
      )}
    </>
  );
  return (
    <>
      <ChatPanel open={chat.open} onOpenChange={chat.toggle} layout={chat.layout}>
        {content}
      </ChatPanel>
      <DialogFrame
        open={Boolean(editing)}
        title={editing?.action === "rename" ? "Ubah judul percakapan" : "Hapus percakapan?"}
        description={
          editing?.action === "rename"
            ? "Beri judul agar mudah ditemukan kembali."
            : "Percakapan yang dihapus tidak akan muncul lagi."
        }
        onClose={() => {
          setEditing(null);
          setError(null);
        }}
        returnFocus={() =>
          document.querySelector<HTMLButtonElement>('[aria-label="Percakapan baru"]')?.focus()
        }
        busy={busy}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {editing?.action === "rename" ? (
            <Input
              aria-label="Judul percakapan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          ) : (
            <p className="break-words text-sm">{editing?.thread.title}</p>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setError(null);
              }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant={editing?.action === "delete" ? "destructive" : "default"}
              disabled={busy}
            >
              {busy ? "Menyimpan…" : editing?.action === "rename" ? "Simpan" : "Hapus"}
            </Button>
          </div>
        </form>
      </DialogFrame>
    </>
  );
}
