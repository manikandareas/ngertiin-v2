import type { ChatMention, ChatPageContext, ChatThread } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiProblemError, type TokenResolver } from "../../../lib/api";
import { useModule } from "../../modules/api/use-modules";
import { chatApi } from "../api/chat-api";
import { mentionDocument, withLockedMention } from "../chat-draft";
import { patchChatSession, useChatSession } from "../chat-session";
import { ChatComposer } from "./chat-composer";
import { ChatWelcome } from "./chat-welcome";

type ChatNewConversationProps = {
  moduleId: string | null;
  lockedContext?: ChatMention;
  contextLabel?: string;
  pageContext?: ChatPageContext;
  root: readonly unknown[];
  getToken: TokenResolver;
  onCreated: (thread: ChatThread) => void;
  fullPage?: boolean;
};

export function ChatNewConversation({
  moduleId,
  lockedContext,
  contextLabel,
  pageContext,
  root,
  getToken,
  onCreated,
  fullPage = false,
}: ChatNewConversationProps) {
  const client = useQueryClient();
  const { session, patch, setDraft } = useChatSession(root, `new:${moduleId ?? "standalone"}`);
  const module = useModule(pageContext?.surface === "node" ? (moduleId ?? undefined) : undefined);
  const creating = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (
      lockedContext ||
      session.sending ||
      session.contextSeeded ||
      (pageContext?.surface === "node" && module.isPending)
    )
      return;
    if (moduleId && !session.draft) {
      const mention = {
        moduleId,
        ...(pageContext?.surface === "node" ? { nodeId: pageContext.nodeId } : {}),
        label: (pageContext?.surface === "node"
          ? `${module.data?.title ?? "Modul belajar"}:${contextLabel ?? "Materi"}`
          : (contextLabel ?? "Modul belajar")
        ).slice(0, 240),
      };
      patch({
        contextSeeded: true,
        mentions: [mention],
        document: mentionDocument(mention),
        draft: `@${mention.label} `,
      });
    } else patch({ contextSeeded: true });
  }, [
    moduleId,
    lockedContext,
    contextLabel,
    pageContext,
    session.contextSeeded,
    session.sending,
    session.draft,
    patch,
    module.data?.title,
    module.isPending,
  ]);
  async function create(text = session.draft) {
    if (!text.trim() || creating.current || session.sending) return;
    creating.current = true;
    patch({ sending: true });
    setError(null);
    try {
      const thread = await chatApi(getToken, moduleId).create(
        [...text.trim()].slice(0, 80).join(""),
      );
      patchChatSession(client, root, thread.id, {
        draft: text.trim(),
        excerpts: session.excerpts,
        mentions: withLockedMention(session.mentions, lockedContext),
        document: text === session.draft ? session.document : undefined,
        autoSend: true,
        pageContext,
      });
      client.setQueryData([...root, "thread", thread.id], thread);
      patch({ draft: "", document: undefined, mentions: [], excerpts: [], contextSeeded: false });
      void client.invalidateQueries({ queryKey: [...root, "threads"] });
      onCreated(thread);
    } catch (e) {
      setDraft(text);
      setError(
        e instanceof ApiProblemError
          ? e.problem.detail
          : "Percakapan belum dapat dibuat. Coba lagi.",
      );
    } finally {
      patch({ sending: false });
      creating.current = false;
    }
  }
  const composer = (
    <>
      {error ? (
        <p role="alert" className="mx-auto w-full max-w-3xl px-6 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ChatComposer
        className={fullPage ? "w-full px-0 pb-0 pt-0 text-left" : undefined}
        fullPage={fullPage}
        draft={session.draft}
        document={session.document}
        lockedContext={lockedContext}
        root={root}
        getToken={getToken}
        onDraftChange={(draft, document, mentions) => patch({ draft, document, mentions })}
        onSend={() => void create()}
        disabled={session.sending}
      />
      {session.sending ? (
        <p role="status" className="pb-2 text-center text-xs text-muted-foreground">
          Membuka percakapan…
        </p>
      ) : null}
    </>
  );
  return (
    <>
      <div
        className={
          fullPage
            ? "flex min-h-0 flex-1 overflow-y-auto px-5 py-10 sm:px-8"
            : "flex min-h-0 flex-1 overflow-y-auto px-6 pb-6"
        }
      >
        <div
          className={fullPage ? "mx-auto my-auto w-full max-w-3xl pb-8 sm:pb-16" : "my-auto w-full"}
        >
          <ChatWelcome
            standalone={!moduleId}
            fullPage={fullPage}
            idlePaused={session.draft.length > 0}
            disabled={session.sending}
            onSuggest={(text) => {
              setDraft(text);
              void create(text);
            }}
          >
            {fullPage ? <div className="mt-8 sm:mt-10">{composer}</div> : null}
          </ChatWelcome>
        </div>
      </div>
      {!fullPage ? composer : null}
    </>
  );
}
