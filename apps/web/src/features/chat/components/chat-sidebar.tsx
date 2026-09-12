import type { ChatPageContext } from "@ngertiin/contracts/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { isClerkConfigured } from "../../../config";
import { patchChatSession, useChatSession } from "../chat-session";
import { useModuleChat } from "../use-module-chat";
import { ChatConversation } from "./chat-conversation";
import { ChatHeader } from "./chat-header";
import { ChatNewConversation } from "./chat-new-conversation";
import { ChatPanel } from "./chat-panel";

type Props = { moduleId: string; pageContext: ChatPageContext; contextLabel?: string };
export function ChatSidebar(props: Props) {
  return isClerkConfigured ? <ConnectedChatSidebar key={props.moduleId} {...props} /> : null;
}
function ConnectedChatSidebar({ moduleId, pageContext, contextLabel = "Modul ini" }: Props) {
  const chat = useModuleChat(moduleId);
  const client = useQueryClient();
  const navigate = useNavigate();
  const { session: newSession } = useChatSession(chat.root, `new:${moduleId}`);
  const selected = useQuery({
    queryKey: [...chat.root, "thread", chat.selectedId],
    queryFn: () => chat.api.get(chat.selectedId ?? ""),
    enabled: Boolean(chat.selectedId && chat.open),
    refetchInterval: chat.open ? 2000 : false,
    retry: false,
  });
  const current = selected.data ?? chat.list.find((thread) => thread.id === chat.selectedId);
  function fullScreen() {
    const sessionId = current?.id ?? `new:${moduleId}`;
    patchChatSession(client, chat.root, sessionId, { pageContext });
    chat.toggle(false);
    navigate(current ? `/chat/${current.id}` : `/chat?moduleId=${moduleId}`);
  }
  return (
    <ChatPanel open={chat.open} onOpenChange={chat.toggle} layout={chat.layout}>
      <ChatHeader
        chat={chat}
        title={current?.title ?? "Percakapan baru"}
        busy={newSession.sending}
        onCreate={() => chat.select(null)}
        onFullScreen={fullScreen}
      />
      {chat.threads.isError || selected.isError ? (
        <div role="alert" className="p-5 text-sm">
          <p>Chat belum dapat dimuat.</p>
          <Button variant="link" onClick={() => void chat.refresh()}>
            Coba lagi
          </Button>
          <Button variant="link" onClick={() => chat.select(null)}>
            Chat baru
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
        />
      ) : chat.selectedId || chat.threads.isPending ? (
        <p role="status" className="p-5 text-sm text-muted-foreground">
          Memuat percakapan…
        </p>
      ) : (
        <ChatNewConversation
          moduleId={moduleId}
          contextLabel={contextLabel}
          pageContext={pageContext}
          root={chat.root}
          getToken={chat.getToken}
          onCreated={(thread) => chat.select(thread.id)}
        />
      )}
    </ChatPanel>
  );
}
