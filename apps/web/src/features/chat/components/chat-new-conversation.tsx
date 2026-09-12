import type { ChatPageContext, ChatThread } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { ApiProblemError, type TokenResolver } from "../../../lib/api";
import { chatApi } from "../api/chat-api";
import { patchChatSession, useChatSession } from "../chat-session";
import { ChatComposer } from "./chat-composer";
import { ChatContextPicker } from "./chat-context-picker";
import { ChatWelcome } from "./chat-welcome";

type ChatNewConversationProps = {
  moduleId: string | null;
  contextLabel?: string;
  pageContext?: ChatPageContext;
  root: readonly unknown[];
  getToken: TokenResolver;
  onCreated: (thread: ChatThread) => void;
  onChooseModule?: () => void;
  onRemoveModule?: () => void;
  fullPage?: boolean;
};

export function ChatNewConversation({
  moduleId,
  contextLabel,
  pageContext,
  root,
  getToken,
  onCreated,
  onChooseModule,
  onRemoveModule,
  fullPage = false,
}: ChatNewConversationProps) {
  const client = useQueryClient();
  const { session, patch, setDraft, setExcerpts } = useChatSession(
    root,
    `new:${moduleId ?? "standalone"}`,
  );
  const creating = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const attach = useRef<HTMLSpanElement>(null);
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
        autoSend: true,
        pageContext,
      });
      client.setQueryData([...root, "thread", thread.id], thread);
      patch({ draft: "", excerpts: [] });
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
  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div className={fullPage ? "mx-auto my-auto w-full max-w-3xl" : "my-auto w-full"}>
          <ChatWelcome
            standalone={!moduleId}
            disabled={session.sending}
            onSuggest={(text) => {
              setDraft(text);
              void create(text);
            }}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="mx-auto w-full max-w-3xl px-6 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ChatComposer
        className={fullPage ? "mx-auto w-full max-w-3xl" : undefined}
        draft={session.draft}
        onDraftChange={setDraft}
        onSend={() => void create()}
        disabled={session.sending}
        contextLabel={contextLabel}
        attachAction={
          <div className="flex flex-wrap gap-1">
            {onChooseModule ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs normal-case"
                disabled={session.sending}
                onClick={onChooseModule}
              >
                {moduleId ? "Ubah modul" : "Tambahkan konteks"}
              </Button>
            ) : null}
            {moduleId ? (
              <span ref={attach}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs normal-case"
                  disabled={session.sending}
                  onClick={() => setPickerOpen(true)}
                >
                  Kutip materi
                </Button>
              </span>
            ) : null}
            {moduleId && onRemoveModule ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Hapus konteks modul"
                disabled={session.sending}
                onClick={onRemoveModule}
              >
                ×
              </Button>
            ) : null}
          </div>
        }
        attachments={
          session.excerpts.length ? (
            <div className="space-y-2 py-2">
              {session.excerpts.map((item, index) => (
                <div
                  key={JSON.stringify(item.reference)}
                  className="flex gap-2 rounded-lg border p-2 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {item.title}: {item.excerpt}
                  </span>
                  <button
                    type="button"
                    aria-label="Hapus kutipan"
                    disabled={session.sending}
                    onClick={() => setExcerpts((items) => items.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : undefined
        }
      />
      {session.sending ? (
        <p role="status" className="pb-2 text-center text-xs text-muted-foreground">
          Membuka percakapan…
        </p>
      ) : null}
      {pickerOpen && moduleId ? (
        <ChatContextPicker
          moduleId={moduleId}
          api={chatApi(getToken, moduleId)}
          root={root}
          pageContext={pageContext ?? { surface: "journey" }}
          onClose={() => setPickerOpen(false)}
          returnFocus={() => attach.current?.querySelector("button")?.focus()}
          onSelect={(item) => {
            setExcerpts((items) => [
              ...items.filter(
                (previous) => JSON.stringify(previous.reference) !== JSON.stringify(item.reference),
              ),
              item,
            ]);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
