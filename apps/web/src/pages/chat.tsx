import type { ChatMention } from "@ngertiin/contracts/api";
import { uuidSchema } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { isClerkConfigured } from "../config";
import { textDocument } from "../features/chat/chat-draft";
import { patchChatSession, useChatSession } from "../features/chat/chat-session";
import { ChatNewConversation } from "../features/chat/components/chat-new-conversation";
import { ChatPageHeader } from "../features/chat/components/chat-page-header";
import { useChatThreads } from "../features/chat/use-chat-threads";
import { useModule, useNode } from "../features/modules/api/use-modules";

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
  const requestedModuleId = search.get("moduleId");
  const moduleId = uuidSchema.safeParse(requestedModuleId).success ? requestedModuleId : null;
  const module = useModule(moduleId ?? undefined);
  const sessionId = `new:${moduleId ?? "standalone"}`;
  const { session } = useChatSession(chat.root, sessionId);
  const suggestedDraft = search.get("draft");
  useEffect(() => {
    if (!suggestedDraft || session.draft) return;
    patchChatSession(client, chat.root, sessionId, {
      draft: suggestedDraft,
      document: textDocument(suggestedDraft),
    });
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("draft");
        return next;
      },
      { replace: true },
    );
  }, [suggestedDraft, session.draft, client, chat.root, sessionId, setSearch]);
  function switchToStandalone() {
    patchChatSession(client, chat.root, "new:standalone", {
      draft: session.draft,
      excerpts: [],
      pageContext: undefined,
    });
    setSearch({});
  }
  const contextLabel = moduleId ? (module.data?.title ?? "Modul belajar") : undefined;
  const pageContext = moduleId ? session.pageContext : undefined;
  const nodeId = pageContext?.surface === "node" ? pageContext.nodeId : undefined;
  const node = useNode(nodeId ? (moduleId ?? undefined) : undefined, nodeId);
  const lockedContext = useMemo<ChatMention | undefined>(() => {
    if (!moduleId) return undefined;
    return {
      moduleId,
      ...(nodeId ? { nodeId } : {}),
      label: (nodeId
        ? `${(contextLabel ?? "Modul belajar").slice(0, 120)}:${(node.data?.node.title ?? "Materi").slice(0, 119)}`
        : (contextLabel ?? "Modul belajar")
      ).slice(0, 240),
    };
  }, [moduleId, nodeId, contextLabel, node.data?.node.title]);
  return (
    <AppShell workspace hideMobileSidebarHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatPageHeader
          title="Chat Baru"
          moduleId={moduleId}
          moduleTitle={module.data?.title ?? undefined}
        />
        {moduleId && (module.isPending || module.isError) ? (
          <div className="m-auto p-6 text-center">
            <p role={module.isError ? "alert" : "status"}>
              {module.isError ? "Konteks modul belum dapat dimuat." : "Memuat konteks modul…"}
            </p>
            {module.isError ? (
              <>
                <Button variant="link" onClick={() => void module.refetch()}>
                  Coba lagi
                </Button>
                <Button variant="link" onClick={switchToStandalone}>
                  Chat tanpa modul
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <ChatNewConversation
            key={sessionId}
            moduleId={moduleId}
            lockedContext={lockedContext}
            contextLabel={contextLabel}
            pageContext={pageContext}
            root={chat.root}
            getToken={chat.getToken}
            onCreated={(created) => navigate(`/chat/${created.id}`, { replace: true })}
            fullPage
          />
        )}
      </div>
    </AppShell>
  );
}
