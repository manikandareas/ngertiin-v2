import { uuidSchema } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { isClerkConfigured } from "../config";
import { patchChatSession, useChatSession } from "../features/chat/chat-session";
import { ChatNewConversation } from "../features/chat/components/chat-new-conversation";
import { useChatThreads } from "../features/chat/use-chat-threads";
import { initialSelection } from "../features/chat/use-module-chat";
import { useModule } from "../features/modules/api/use-modules";

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
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const chat = useChatThreads();
  const requestedModule = search.get("moduleId");
  const selectedModuleId = uuidSchema.safeParse(requestedModule).success ? requestedModule : null;
  const moduleId = selectedModuleId;
  const module = useModule(moduleId ?? undefined);
  const sessionId = `new:${moduleId ?? "standalone"}`;
  const { session } = useChatSession(chat.root, sessionId);
  function chooseModule(nextId: string | null) {
    patchChatSession(client, chat.root, `new:${nextId ?? "standalone"}`, {
      draft: session.draft,
      excerpts: [],
      pageContext: undefined,
    });
    setSearch(nextId ? { moduleId: nextId } : {});
  }
  const contextLabel = moduleId ? (module.data?.title ?? "Modul belajar") : undefined;
  const pageContext = moduleId ? session.pageContext : undefined;
  const returnTo =
    moduleId && pageContext?.surface === "node"
      ? `/modules/${moduleId}/nodes/${pageContext.nodeId}`
      : `/modules/${moduleId}/journey`;
  function renderContent(): ReactNode {
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
    <AppShell workspace>
      {moduleId ? (
        <header className="flex min-h-16 shrink-0 items-center gap-3 px-5 py-3 sm:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold">Chat baru</h1>
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
                      threadId: "new",
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
        </header>
      ) : null}
      {renderContent()}
    </AppShell>
  );
}
