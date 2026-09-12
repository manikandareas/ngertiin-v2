import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { patchChatSession } from "../chat-session";
import { useChatThreads } from "../use-chat-threads";
import { ChatThreadActions } from "./chat-thread-actions";

export function ChatSidebarSection({ collapsed = false }: { collapsed?: boolean }) {
  const chat = useChatThreads();
  const client = useQueryClient();
  const { threadId } = useParams();
  const navigate = useNavigate();
  return (
    <section
      aria-label="Percakapan Chat"
      className={`mt-5 flex min-h-0 flex-1 flex-col ${collapsed ? "px-2" : "px-3"}`}
    >
      <Button
        variant="outline"
        asChild
        className={
          collapsed ? "size-11 shrink-0 px-0" : "w-full shrink-0 justify-start gap-2 normal-case"
        }
      >
        <Link
          to="/chat"
          title="Chat baru"
          aria-label="Chat baru"
          onClick={() =>
            patchChatSession(client, chat.root, "new:standalone", {
              draft: "",
              excerpts: [],
              pageContext: undefined,
            })
          }
        >
          <Plus className="size-4" />
          {!collapsed ? "Chat baru" : null}
        </Link>
      </Button>
      {!collapsed ? (
        <>
          <p className="mb-2 mt-5 px-2 text-xs font-medium text-muted-foreground">Percakapan</p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
            {chat.threads.isPending ? (
              <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
                Memuat percakapan…
              </p>
            ) : null}
            {chat.threads.isError ? (
              <div role="alert" className="px-2 py-3 text-xs">
                <p>Riwayat belum dapat dimuat.</p>
                <Button variant="link" size="sm" onClick={() => void chat.threads.refetch()}>
                  Coba lagi
                </Button>
              </div>
            ) : null}
            {!chat.threads.isPending && !chat.threads.isError && !chat.list.length ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Percakapanmu akan muncul di sini.
              </p>
            ) : null}
            {chat.list.map((thread) => (
              <div
                key={thread.id}
                className={`flex min-w-0 items-center rounded-lg ${thread.id === threadId ? "bg-sidebar-accent" : "hover:bg-muted"}`}
              >
                <Link
                  to={`/chat/${thread.id}`}
                  aria-current={thread.id === threadId ? "page" : undefined}
                  className="min-w-0 flex-1 rounded-lg px-2 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="block truncate">{thread.title}</span>
                  {thread.moduleId ? (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {thread.moduleTitle ?? "Modul belajar"}
                    </span>
                  ) : null}
                  {thread.activeRunId ? (
                    <span className="block text-[10px] text-muted-foreground">
                      Sedang menjawab…
                    </span>
                  ) : null}
                </Link>
                <ChatThreadActions
                  thread={thread}
                  api={chat.api}
                  root={chat.root}
                  onDeleted={() => {
                    if (thread.id === threadId) navigate("/chat", { replace: true });
                  }}
                />
              </div>
            ))}
            {chat.threads.hasNextPage ? (
              <Button
                variant="link"
                size="sm"
                disabled={chat.threads.isFetchingNextPage}
                onClick={() => void chat.threads.fetchNextPage()}
              >
                Muat lainnya
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
