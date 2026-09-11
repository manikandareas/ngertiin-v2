import { type ChatPageContext, type ChatThread, chatTitleSchema } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MessageCircle, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, useSyncExternalStore } from "react";
import { Button } from "../../../components/ui/button";
import { DialogFrame } from "../../../components/ui/dialog-frame";
import { Input } from "../../../components/ui/input";
import { isClerkConfigured } from "../../../config";
import { ApiProblemError } from "../../../lib/api";
import { useModuleChat } from "../use-module-chat";
import { ChatConversation } from "./chat-conversation";

const subscribeMobile = (callback: () => void) => {
  const query = window.matchMedia("(max-width: 1023px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const mobileSnapshot = () => window.matchMedia("(max-width: 1023px)").matches;
export function ChatSidebar(props: { moduleId: string; pageContext: ChatPageContext }) {
  return isClerkConfigured ? <ConnectedChatSidebar key={props.moduleId} {...props} /> : null;
}
function ConnectedChatSidebar({
  moduleId,
  pageContext,
}: {
  moduleId: string;
  pageContext: ChatPageContext;
}) {
  const chat = useModuleChat(moduleId);
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const [listOpen, setListOpen] = useState(false);
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
  async function create() {
    setBusy(true);
    setError(null);
    try {
      const thread = await chat.api.create();
      chat.select(thread.id);
      setListOpen(false);
      await chat.refresh();
    } catch (e) {
      setError(e instanceof ApiProblemError ? e.problem.detail : "Percakapan belum dapat dibuat.");
    } finally {
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
  const launcher = (
    <Button
      type="button"
      size="sm"
      className="fixed right-5 bottom-5 z-30 gap-2 rounded-xl normal-case"
      onClick={() => chat.toggle(true)}
      aria-label="Buka teman belajar"
    >
      <MessageCircle aria-hidden="true" />
      Teman belajar
    </Button>
  );
  const content = (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b px-5 py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-link">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Teman belajar</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Ruang untuk rasa penasaranmu</p>
        </div>
        <div className="ml-auto flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => void create()}
            disabled={busy}
            aria-label="Percakapan baru"
          >
            <Plus aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => chat.toggle(false)}
            aria-label="Tutup chat"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>
      <button
        type="button"
        onClick={() => setListOpen(!listOpen)}
        aria-expanded={listOpen}
        aria-controls="chat-thread-list"
        className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4 text-left text-xs hover:bg-accent"
      >
        <span className="truncate font-semibold">
          {current?.title ?? "Percakapan dalam modul ini"}
        </span>
        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      </button>
      {listOpen ? (
        <div
          id="chat-thread-list"
          className="max-h-64 shrink-0 overflow-y-auto border-b bg-muted/30 p-2"
        >
          {chat.list.map((thread) => (
            <div
              key={thread.id}
              className={`flex items-center rounded-lg ${thread.id === chat.selectedId ? "bg-accent" : ""}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate p-3 text-left text-xs"
                onClick={() => {
                  chat.select(thread.id);
                  setListOpen(false);
                }}
              >
                {thread.title}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Ubah judul ${thread.title}`}
                onClick={() => {
                  setTitle(thread.title);
                  setEditing({ thread, action: "rename" });
                }}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Hapus ${thread.title}`}
                onClick={() => setEditing({ thread, action: "delete" })}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
          {chat.threads.hasNextPage ? (
            <Button
              size="sm"
              variant="link"
              onClick={() => void chat.threads.fetchNextPage()}
              disabled={chat.threads.isFetchingNextPage}
            >
              Muat percakapan lainnya
            </Button>
          ) : null}
        </div>
      ) : null}
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
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center p-6">
          <Sparkles className="mb-6 size-9 text-link" aria-hidden="true" />
          <h3 className="font-display text-2xl font-bold">Mulai dari rasa penasaran.</h3>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Buat percakapan untuk menemani perjalanan belajarmu dalam modul ini.
          </p>
          <Button
            className="mt-6 normal-case"
            disabled={busy || chat.threads.isPending}
            onClick={() => void create()}
          >
            {chat.threads.isPending ? "Memuat…" : "Mulai percakapan"}
          </Button>
        </div>
      )}
    </>
  );
  return (
    <>
      {mobile ? (
        <Dialog.Root open={chat.open} onOpenChange={chat.toggle}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l bg-background text-foreground shadow-xl"
            >
              <Dialog.Title className="sr-only">Teman belajar</Dialog.Title>
              {content}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : chat.open ? (
        <aside
          aria-label="Teman belajar"
          className="flex h-full min-h-0 w-[360px] shrink-0 flex-col border-l bg-background xl:w-[390px] 2xl:w-[430px]"
        >
          {content}
        </aside>
      ) : null}
      {!chat.open ? launcher : null}
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
