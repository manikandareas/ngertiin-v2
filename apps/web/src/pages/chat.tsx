import { uuidSchema } from "@ngertiin/contracts/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { isClerkConfigured } from "../config";
import { chatApi } from "../features/chat/api/chat-api";
import { patchChatSession, useChatSession } from "../features/chat/chat-session";
import {
  ChatCitationReader,
  type ChatCitationSelection,
} from "../features/chat/components/chat-citation";
import { ChatConversation } from "../features/chat/components/chat-conversation";
import { ChatNewConversation } from "../features/chat/components/chat-new-conversation";
import { ChatThreadActions } from "../features/chat/components/chat-thread-actions";
import { useChatThreads } from "../features/chat/use-chat-threads";
import { initialSelection } from "../features/chat/use-module-chat";
import { useModule } from "../features/modules/api/use-modules";
import { ApiProblemError } from "../lib/api";

export default function ChatPage() {
  return isClerkConfigured ? (
    <ConnectedChatPage />
  ) : (
    <AppShell>
      <p>Masuk untuk mulai berdiskusi dengan Teman Belajar.</p>
    </AppShell>
  );
}
function ConnectedChatPage() {
  const { threadId } = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const chat = useChatThreads();
  const requestedModule = search.get("moduleId");
  const selectedModuleId = uuidSchema.safeParse(requestedModule).success ? requestedModule : null;
  const validThread = uuidSchema.safeParse(threadId).success;
  const detail = useQuery({
    queryKey: [...chat.root, "thread", threadId],
    queryFn: () => chat.api.get(threadId ?? ""),
    enabled: Boolean(threadId && validThread),
    retry: false,
    refetchInterval: (query) => (query.state.data?.activeRunId ? 2000 : false),
  });
  const thread = detail.data;
  const moduleId = threadId ? (thread?.moduleId ?? null) : selectedModuleId;
  const module = useModule(!threadId && moduleId ? moduleId : undefined);
  const sessionId = threadId ?? `new:${moduleId ?? "standalone"}`;
  const { session } = useChatSession(chat.root, sessionId);
  const [citation, setCitation] = useState<ChatCitationSelection | null>(null);
  const citationTrigger = useRef<HTMLElement | null>(null);
  function chooseModule(nextId: string | null) {
    if (!threadId)
      patchChatSession(client, chat.root, `new:${nextId ?? "standalone"}`, {
        draft: session.draft,
        excerpts: [],
        pageContext: undefined,
      });
    if (threadId) navigate(nextId ? `/chat?moduleId=${nextId}` : "/chat");
    else setSearch(nextId ? { moduleId: nextId } : {});
  }
  const contextLabel = moduleId
    ? (thread?.moduleTitle ?? module.data?.title ?? "Modul belajar")
    : undefined;
  const pageContext = moduleId ? session.pageContext : undefined;
  const api = useMemo(() => chatApi(chat.getToken, moduleId), [chat.getToken, moduleId]);
  const returnTo =
    moduleId && pageContext?.surface === "node"
      ? `/modules/${moduleId}/nodes/${pageContext.nodeId}`
      : `/modules/${moduleId}/journey`;
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
          onOpenCitation={(selection) => {
            citationTrigger.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setCitation(selection);
          }}
          fullPage
        />
      );
    }
    if (moduleId && (module.isPending || module.isError))
      return (
        <div className="m-auto p-6 text-center">
          <p role={module.isError ? "alert" : "status"}>
            {module.isError ? "Konteks modul belum dapat dimuat." : "Memuat konteks modul…"}
          </p>
          {module.isError ? (
            <>
              <Button variant="link" onClick={() => void module.refetch()}>
                Coba lagi
              </Button>
              <Button variant="link" onClick={() => chooseModule(null)}>
                Chat tanpa modul
              </Button>
            </>
          ) : null}
        </div>
      );
    return (
      <ChatNewConversation
        key={sessionId}
        moduleId={moduleId}
        contextLabel={contextLabel}
        pageContext={pageContext}
        root={chat.root}
        getToken={chat.getToken}
        onCreated={(created) => navigate(`/chat/${created.id}`, { replace: true })}
        fullPage
      />
    );
  }
  return (
    <AppShell
      workspace
      rightSidebar={
        citation && citation.threadId === threadId && thread && !unavailable ? (
          <ChatCitationReader
            key={citation.citation.id}
            {...citation}
            api={chat.api}
            panel
            onSelect={(next) => setCitation({ ...citation, citation: next })}
            onClose={() => setCitation(null)}
            returnFocus={() => citationTrigger.current?.focus()}
          />
        ) : undefined
      }
    >
      {threadId || moduleId ? (
        <header className="flex min-h-16 shrink-0 items-center gap-3 px-5 py-3 sm:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold">
              {thread?.title ?? "Chat baru"}
            </h1>
            {contextLabel ? (
              <p className="truncate text-xs text-muted-foreground">Dibuka dari {contextLabel}</p>
            ) : null}
          </div>
          {moduleId ? (
            <Button variant="ghost" size="sm" className="text-xs normal-case" asChild>
              <Link
                to={returnTo}
                onClick={() =>
                  client.setQueryData(
                    [...chat.root, "selection", moduleId],
                    (previous: typeof initialSelection | undefined) => ({
                      ...initialSelection,
                      ...previous,
                      threadId: threadId ?? "new",
                      open: true,
                    }),
                  )
                }
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Kembali ke modul</span>
                <span className="sm:hidden">Modul</span>
              </Link>
            </Button>
          ) : null}
          {thread ? (
            <ChatThreadActions
              thread={thread}
              api={chat.api}
              root={chat.root}
              onDeleted={() => navigate("/chat", { replace: true })}
            />
          ) : null}
        </header>
      ) : null}
      {renderContent()}
    </AppShell>
  );
}
