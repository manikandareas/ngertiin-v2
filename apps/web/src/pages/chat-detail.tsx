import { uuidSchema } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { isClerkConfigured } from "../config";
import { chatApi } from "../features/chat/api/chat-api";
import { ChatConversation } from "../features/chat/components/chat-conversation";
import { ChatPageHeader } from "../features/chat/components/chat-page-header";
import { ChatThreadActions } from "../features/chat/components/chat-thread-actions";
import { useChatThreads } from "../features/chat/use-chat-threads";
import { useModule } from "../features/modules/api/use-modules";
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
  const module = useModule(moduleId ?? undefined);
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
    <AppShell workspace hideMobileSidebarHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatPageHeader
          title={
            thread?.title ?? (unavailable ? "Percakapan tidak tersedia" : "Memuat percakapan…")
          }
          moduleId={moduleId}
          moduleTitle={module.data?.title ?? undefined}
          actions={
            thread ? (
              <ChatThreadActions
                triggerIcon={<ChevronDown className="size-4" aria-hidden="true" />}
                thread={thread}
                api={chat.api}
                root={chat.root}
                onDeleted={() => navigate("/chat", { replace: true })}
              />
            ) : null
          }
        />
        {renderContent()}
      </div>
    </AppShell>
  );
}
