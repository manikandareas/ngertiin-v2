import { useUser } from "@clerk/react";
import { uuidSchema } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { UserAvatar } from "../components/user-avatar";
import { isClerkConfigured } from "../config";
import { chatApi } from "../features/chat/api/chat-api";
import { ChatConversation } from "../features/chat/components/chat-conversation";
import { ChatThreadActions } from "../features/chat/components/chat-thread-actions";
import { useChatThreads } from "../features/chat/use-chat-threads";
import { useCurrentUser } from "../features/current-user/api/use-current-user";
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
  const { user: clerkUser } = useUser();
  const currentUser = useCurrentUser();
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
  const userName = currentUser.data?.displayName || clerkUser?.fullName || "Akun belajar";
  const avatarUrl = currentUser.data?.avatarUrl || clerkUser?.imageUrl;
  return (
    <AppShell workspace hideMobileSidebarHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-border bg-background px-4 py-2.5 sm:gap-3 sm:px-6 xl:pointer-events-none xl:border-b-0 xl:bg-transparent">
          <button
            type="button"
            aria-label="Buka menu navigasi"
            onClick={() => window.dispatchEvent(new Event("ngertiin:open-mobile-sidebar"))}
            className="pointer-events-auto grid size-9 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:hidden"
          >
            {avatarUrl ? (
              <UserAvatar avatarUrl={avatarUrl} name={userName} className="size-8 rounded-lg" />
            ) : (
              <span className="grid size-8 place-items-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                {userName[0]?.toLocaleUpperCase("id-ID")}
              </span>
            )}
          </button>
          <h1
            className="pointer-events-auto mr-auto min-w-0 max-w-[min(60%,24rem)] truncate text-sm font-medium xl:rounded-xl xl:bg-background xl:px-3 xl:py-2"
            title={thread?.title}
          >
            {thread?.title ?? (unavailable ? "Percakapan tidak tersedia" : "Memuat percakapan…")}
          </h1>
          <div className="pointer-events-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {thread ? (
              <ChatThreadActions
                thread={thread}
                api={chat.api}
                root={chat.root}
                onDeleted={() => navigate("/chat", { replace: true })}
              />
            ) : null}
          </div>
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
