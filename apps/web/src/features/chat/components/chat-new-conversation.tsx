import type { ChatMention, ChatPageContext, ChatThread } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiProblemError, type TokenResolver } from "../../../lib/api";
import { useModule } from "../../modules/api/use-modules";
import { chatApi } from "../api/chat-api";
import { mentionDocument, textDocument, withLockedMention } from "../chat-draft";
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
  function appendSuggestion(text: string) {
    const suffix = `${session.draft && !/\s$/.test(session.draft) ? " " : ""}${text.trim()} `;
    const document = structuredClone(session.document ?? textDocument(session.draft));
    const content = document.content ?? [];
    const lastParagraph = content.at(-1);
    if (lastParagraph?.type === "paragraph") {
      lastParagraph.content = [...(lastParagraph.content ?? []), { type: "text", text: suffix }];
    } else {
      content.push({ type: "paragraph", content: [{ type: "text", text: suffix }] });
    }
    patch({ draft: session.draft + suffix, document: { ...document, content } });
  }

  async function create(text = session.draft) {
    if ((!text.trim() && !session.attachments.length) || creating.current || session.sending)
      return;
    creating.current = true;
    patch({ sending: true });
    setError(null);
    try {
      const thread = await chatApi(getToken, moduleId).create(
        [...(text.trim() || session.attachments[0]?.filename || "Lampiran")].slice(0, 80).join(""),
      );
      patchChatSession(client, root, thread.id, {
        draft: text.trim(),
        excerpts: session.excerpts,
        attachments: session.attachments,
        mentions: withLockedMention(session.mentions, lockedContext),
        document: text === session.draft ? session.document : undefined,
        autoSend: true,
        pageContext,
      });
      client.setQueryData([...root, "thread", thread.id], thread);
      patch({
        attachments: [],
        draft: "",
        document: undefined,
        mentions: [],
        excerpts: [],
        contextSeeded: false,
      });
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
        className={fullPage ? "mx-auto w-full max-w-3xl sm:pb-6" : undefined}
        fullPage={fullPage}
        attachments={session.attachments}
        onAttachmentsChange={(attachments) => patch({ attachments })}
        draft={session.draft}
        document={session.document}
        lockedContext={lockedContext}
        root={root}
        getToken={getToken}
        onDraftChange={(draft, document, mentions) => patch({ draft, document, mentions })}
        onSend={() => void create()}
        disabled={session.sending}
      />
    </>
  );
  return (
    <>
      <div
        className={
          fullPage
            ? "flex min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-22 sm:px-8 sm:pt-26"
            : "flex min-h-0 flex-1 overflow-y-auto px-6 pb-6"
        }
      >
        <div
          className={fullPage ? "mx-auto my-auto w-full max-w-3xl py-6 sm:py-10" : "my-auto w-full"}
        >
          <ChatWelcome
            standalone={!moduleId}
            fullPage={fullPage}
            idlePaused={session.draft.length > 0}
            disabled={session.sending}
            onSuggest={appendSuggestion}
          />
        </div>
      </div>
      {composer}
    </>
  );
}
