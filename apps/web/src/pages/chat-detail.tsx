import { uuidSchema } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { isClerkConfigured } from "../config";
import { chatApi } from "../features/chat/api/chat-api";
import { ChatConversation } from "../features/chat/components/chat-conversation";
import { ChatMascot } from "../features/chat/components/chat-mascot";
import { ChatThreadActions } from "../features/chat/components/chat-thread-actions";
import { CHAT_AGENT_NAME } from "../features/chat/constants";
import { useChatThreads } from "../features/chat/use-chat-threads";
import { ApiProblemError } from "../lib/api";

export default function ChatDetailPage() {
  return isClerkConfigured ? (
    <ConnectedChatDetailPage />
  ) : (
    <AppShell>
      <p>Masuk untuk mulai berdiskusi dengan Teman Belajar.</p>
    </AppShell>
  );
}
function ConnectedChatDetailPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const chat = useChatThreads();
  const validThread = uuidSchema.safeParse(threadId).success;
  const detail = useQuery({
    queryKey: [...chat.root, "thread", threadId],
    queryFn: () => chat.api.get(threadId ?? ""),
    enabled: Boolean(threadId && validThread),
    retry: false,
    refetchInterval: (query) => (query.state.data?.activeRunId ? 2000 : false),
  });
  const thread = detail.data;
  const moduleId = thread?.moduleId ?? null;
  const api = useMemo(() => chatApi(chat.getToken, moduleId), [chat.getToken, moduleId]);
  const unavailable = Boolean(threadId && (!validThread || detail.isError));
  function renderContent(): ReactNode {
    if (unavailable)
      return (
        <div role="alert" className="m-auto max-w-md p-6 text-center">
          <h2 className="font-display text-xl font-bold">Percakapan belum dapat dibuka</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {detail.error instanceof ApiProblemError
              ? detail.error.problem.detail
              : "Periksa tautan dan akses percakapan ini."}
          </p>
          {validThread ? (
            <Button variant="link" onClick={() => void detail.refetch()}>
              Coba lagi
            </Button>
          ) : null}
          <Button variant="link" asChild>
            <Link to="/chat">Chat baru</Link>
          </Button>
        </div>
      );
    if (threadId) {
      if (!thread)
        return (
          <p role="status" className="m-auto text-sm text-muted-foreground">
            Memuat percakapan…
          </p>
        );
      return (
        <ChatConversation
          key={thread.id}
          thread={thread}
          api={api}
          root={chat.root}
          getToken={chat.getToken}
          moduleId={thread.moduleId}
          fullPage
        />
      );
    }
    return null;
  }
  return (
    <AppShell workspace>
      <header className="flex h-14 shrink-0 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link
          to="/chat"
          className="flex shrink-0 items-center gap-2 rounded-lg py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Kembali ke chat baru"
        >
          <ChatMascot className="size-7" />
          <span className="hidden sm:inline">{CHAT_AGENT_NAME}</span>
        </Link>
        <span aria-hidden="true" className="text-lg text-muted-foreground/50">
          /
        </span>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium" title={thread?.title}>
          {thread?.title ?? (unavailable ? "Percakapan tidak tersedia" : "Memuat percakapan…")}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-lg text-muted-foreground"
          asChild
        >
          <Link to="/chat" aria-label="Percakapan baru" title="Percakapan baru">
            <MessageSquarePlus className="size-4" />
          </Link>
        </Button>
        {thread ? (
          <ChatThreadActions
            thread={thread}
            api={chat.api}
            root={chat.root}
            onDeleted={() => navigate("/chat", { replace: true })}
          />
        ) : null}
      </header>
      {renderContent()}
    </AppShell>
  );
}
