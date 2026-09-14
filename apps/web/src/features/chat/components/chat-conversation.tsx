import { useChat } from "@ai-sdk/react";
import {
  type ChatAcknowledgment,
  type ChatMention,
  type ChatPageContext,
  type ChatRunError,
  type ChatRunStatus,
  type ChatThread,
  chatAttachmentSchema,
  chatCitationSchema,
  chatRunDataSchema,
  isChatRunActive,
} from "@ngertiin/contracts/api";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useStickToBottom } from "use-stick-to-bottom";
import { Button } from "../../../components/ui/button";
import { ApiProblemError, type TokenResolver } from "../../../lib/api";
import type { chatApi } from "../api/chat-api";
import { createChatTransport, type LearningMessage, toUIMessage } from "../api/chat-transport";
import { withLockedMention } from "../chat-draft";
import { useChatSession } from "../chat-session";
import { CHAT_AGENT_NAME } from "../constants";
import { ChatAttachmentCard } from "./chat-attachment-card";
import { ChatCitedAnswer } from "./chat-citation";
import { ChatComposer } from "./chat-composer";
import { ChatMascot } from "./chat-mascot";
import { ChatWelcome } from "./chat-welcome";

type ChatConversationProps = {
  thread: ChatThread;
  api: ReturnType<typeof chatApi>;
  root: readonly unknown[];
  getToken: TokenResolver;
  moduleId: string | null;
  lockedContext?: ChatMention;
  fullPage?: boolean;
};

export function ChatConversation({
  thread,
  api,
  root,
  getToken,
  moduleId,
  lockedContext,
  fullPage = false,
}: ChatConversationProps) {
  const client = useQueryClient();
  const { session, patch, setDraft, setExcerpts } = useChatSession(root, thread.id);
  const { draft, excerpts, pending, ack } = session;
  const setAck = useCallback((value: ChatAcknowledgment | null) => patch({ ack: value }), [patch]);
  const initialSent = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { scrollRef, contentRef, isAtBottom, scrollToBottom, stopScroll } = useStickToBottom({
    initial: "smooth",
    resize: "smooth",
  });
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: root });
  }, [client, root]);
  const onAccepted = useCallback(
    (value: ChatAcknowledgment) => {
      setAck(value);
      setObservedRunId(value.runId);
      setDraft((current) => (current.trim() === pending.current?.text ? "" : current));
      setExcerpts([]);
      patch({ attachments: [] });
      refresh();
    },
    [refresh, setAck, setDraft, setExcerpts, pending, patch],
  );
  const transport = useMemo(
    () => createChatTransport({ threadId: thread.id, token: getToken, onAccepted }),
    [thread.id, getToken, onAccepted],
  );
  const chat = useChat<LearningMessage>({
    id: thread.id,
    transport,
    dataPartSchemas: {
      attachment: chatAttachmentSchema,
      "run-status": chatRunDataSchema,
      citation: chatCitationSchema,
    },
    onFinish: refresh,
    onError: refresh,
  });
  const streaming = chat.status === "submitted" || chat.status === "streaming";
  const [observedRunId, setObservedRunId] = useState(thread.activeRunId);
  useEffect(() => {
    if (thread.activeRunId) setObservedRunId(thread.activeRunId);
  }, [thread.activeRunId]);
  const history = useInfiniteQuery({
    queryKey: [...root, thread.id, "messages"],
    queryFn: ({ pageParam }) => api.messages(thread.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    // Infinite-query refetches include every loaded page. Keep history traffic
    // bounded as older pages accumulate, leaving room for thread/run polling.
    refetchInterval: (query) =>
      streaming || thread.activeRunId
        ? 2000 * Math.max(1, query.state.data?.pages.length ?? 1)
        : false,
  });
  const lastThreadRevision = useRef({
    updatedAt: thread.updatedAt,
    activeRunId: thread.activeRunId,
  });
  useEffect(() => {
    if (
      lastThreadRevision.current.updatedAt === thread.updatedAt &&
      lastThreadRevision.current.activeRunId === thread.activeRunId
    )
      return;
    lastThreadRevision.current = { updatedAt: thread.updatedAt, activeRunId: thread.activeRunId };
    void client.invalidateQueries({ queryKey: [...root, thread.id, "messages"] });
  }, [client, root, thread.id, thread.updatedAt, thread.activeRunId]);
  const saved = useMemo(
    () =>
      [...new Map(history.data?.pages.flatMap((p) => p.data).map((m) => [m.id, m])).values()].sort(
        (a, b) => a.sequence - b.sequence,
      ),
    [history.data],
  );
  // Retain the observed run until its terminal status is read, even if the thread
  // poll clears activeRunId first. Otherwise the last partial snapshot can stick.
  const runId =
    (streaming ? ack?.runId : null) ??
    thread.activeRunId ??
    observedRunId ??
    ack?.runId ??
    saved.at(-1)?.runId ??
    null;
  const run = useQuery({
    queryKey: [...root, "run", runId],
    queryFn: () => api.run(thread.id, runId ?? ""),
    enabled: Boolean(runId),
    refetchInterval: (query) =>
      !query.state.data || isChatRunActive(query.state.data.status) ? 2000 : false,
  });
  const active =
    session.sending ||
    streaming ||
    Boolean(runId && (!run.data || isChatRunActive(run.data.status)));
  const savedAssistant = saved.find(
    (message) => message.role === "assistant" && message.runId === ack?.runId,
  );
  const hasFinalSnapshot = Boolean(
    savedAssistant?.parts.some(
      (part) => part.type === "data-run-status" && !isChatRunActive(part.data.status),
    ),
  );
  const showStream =
    streaming ||
    Boolean(
      ack &&
        !savedAssistant &&
        chat.messages.some(
          (message) => message.role === "assistant" && message.metadata?.runId === ack.runId,
        ),
    );
  useEffect(() => {
    if (run.data && !isChatRunActive(run.data.status)) {
      // A dead SSE connection cannot keep the composer busy after durable completion.
      if (streaming && ack?.runId === run.data.id) void chat.stop();
      refresh();
    }
  }, [run.data, refresh, streaming, ack?.runId, chat.stop]);
  useEffect(() => {
    if (!showStream && history.data && (!ack || saved.some((m) => m.id === ack.messageId)))
      chat.setMessages(saved.map(toUIMessage));
  }, [saved, showStream, history.data, ack, chat.setMessages]);
  useEffect(() => {
    if (chat.error && hasFinalSnapshot) chat.clearError();
  }, [hasFinalSnapshot, chat.error, chat.clearError]);
  // Disconnecting this transport must never cancel the durable run.
  useEffect(
    () => () => {
      void chat.stop();
    },
    [chat.stop],
  );
  const unavailableRuns = new Set(
    saved.filter((m) => m.availability === "unavailable").map((m) => m.runId),
  );
  const rendered = new Map(
    saved.filter((m) => m.availability === "available").map((m) => [m.id, toUIMessage(m)]),
  );
  const latestUserMessage = chat.messages.filter((message) => message.role === "user").at(-1);
  if (showStream && !(ack && unavailableRuns.has(ack.runId)))
    for (const message of chat.messages) {
      if (message.metadata?.runId && unavailableRuns.has(message.metadata.runId)) continue;
      if (message.role === "assistant") rendered.set(message.id, message);
      else if (message === latestUserMessage && (!ack || !rendered.has(ack.messageId)))
        rendered.set(ack?.messageId ?? message.id, message);
    }
  const messages = [...rendered.values()];
  const activeAssistant = active
    ? messages.find((message) => message.role === "assistant" && message.metadata?.runId === runId)
    : undefined;
  const loadingIndicator = (
    <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
      <ChatMascot className="size-7" thinking />
      {run.data?.status === "cancelling"
        ? "Menghentikan jawaban…"
        : `${CHAT_AGENT_NAME} sedang menjawab…`}
    </p>
  );
  const terminal =
    run.data && !isChatRunActive(run.data.status) && run.data.status !== "completed"
      ? run.data
      : null;
  const safeError =
    actionError ??
    (history.error instanceof ApiProblemError
      ? history.error.problem.detail
      : history.isError
        ? "Riwayat belum dapat dimuat."
        : null) ??
    (run.isError ? "Status jawaban belum dapat dimuat. Coba muat ulang riwayat." : null) ??
    (chat.error instanceof ApiProblemError
      ? chat.error.problem.detail
      : chat.error
        ? "Koneksi terputus. Periksa status dan riwayat sebelum mengirim lagi."
        : null);
  async function send(
    retryOfRunId?: string,
    text = draft,
    references = excerpts.map((item) => item.reference),
    sentPageContext: ChatPageContext | undefined = undefined,
    mentions = withLockedMention(session.mentions, lockedContext),
    attachmentIds = session.attachments.map((attachment) => attachment.id),
  ) {
    const trimmed = text.trim();
    if ((!trimmed && !attachmentIds.length) || active || history.isPending || history.isError)
      return;
    setActionError(null);
    chat.clearError();
    void scrollToBottom();
    if (
      !pending.current ||
      pending.current.text !== trimmed ||
      JSON.stringify(pending.current.attachmentIds) !== JSON.stringify(attachmentIds) ||
      JSON.stringify(pending.current.pageContext) !== JSON.stringify(sentPageContext) ||
      pending.current.retryOfRunId !== retryOfRunId ||
      JSON.stringify(pending.current.references) !== JSON.stringify(references) ||
      JSON.stringify(pending.current.mentions) !== JSON.stringify(mentions) ||
      ack
    ) {
      pending.current = {
        key: crypto.randomUUID(),
        attachmentIds,
        text: trimmed,
        pageContext: sentPageContext,
        retryOfRunId,
        references,
        mentions,
      };
    }
    setAck(null);
    patch({ sending: true });
    try {
      await chat.sendMessage(
        { text: trimmed },
        {
          body: {
            pageContext: sentPageContext,
            retryOfRunId,
            references: pending.current.references,
            mentions: pending.current.mentions,
            attachmentIds: pending.current.attachmentIds,
            idempotencyKey: pending.current.key,
          },
        },
      );
    } finally {
      patch({ sending: false });
    }
  }
  async function cancel() {
    if (!runId) return;
    setCancelling(true);
    try {
      await api.cancel(thread.id, runId);
      refresh();
    } catch {
      setActionError("Jawaban belum dapat dihentikan. Coba lagi.");
    } finally {
      setCancelling(false);
    }
  }
  const sendInitial = useEffectEvent(() => {
    patch({ autoSend: false });
    void send();
  });
  useEffect(() => {
    if (session.autoSend && history.isSuccess && !initialSent.current) {
      initialSent.current = true;
      sendInitial();
    }
  }, [session.autoSend, history.isSuccess]);
  const retryMessage = terminal
    ? saved.find((m) => m.id === terminal.messageId && m.availability === "available")
    : undefined;
  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            ref={contentRef}
            className={`flex min-h-full flex-col px-6 pb-4 [&>*]:shrink-0 ${fullPage ? "pt-8 sm:pt-12" : "pt-5"}`}
            style={
              fullPage ? { paddingInline: "max(1rem, calc((100% - 48rem) / 2 + 1rem))" } : undefined
            }
            role="log"
            aria-label="Pesan percakapan"
            aria-live="off"
          >
            {history.hasNextPage ? (
              <Button
                variant="link"
                size="sm"
                className="mx-auto mb-5 flex text-xs"
                disabled={history.isFetchingNextPage}
                onClick={() => {
                  stopScroll();
                  void history.fetchNextPage();
                }}
              >
                Muat pesan sebelumnya
              </Button>
            ) : null}
            {history.isPending ? (
              <p role="status" className="text-sm text-muted-foreground">
                Memuat percakapan…
              </p>
            ) : null}
            {!history.isPending && !history.isError && !messages.length ? (
              <ChatWelcome
                standalone={!moduleId}
                disabled={active}
                onSuggest={(text) => {
                  setDraft(text);
                  void send(undefined, text);
                }}
              />
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? `ml-auto max-w-[90%] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-7 ${fullPage ? "mb-10" : "mb-6 rounded-br-sm"}`
                    : `${fullPage ? "mb-10" : "mb-7"} text-sm leading-7`
                }
              >
                {message === activeAssistant ? (
                  <div className="mb-3">{loadingIndicator}</div>
                ) : null}
                {!fullPage && message.role === "assistant" && message !== activeAssistant ? (
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold">
                    <ChatMascot className="size-7" />
                    {CHAT_AGENT_NAME}
                  </div>
                ) : null}
                {message.role === "assistant" ? (
                  <ChatCitedAnswer
                    isAnimating={message === activeAssistant}
                    text={message.parts
                      .filter((p) => p.type === "text")
                      .map((p) => p.text)
                      .join("")}
                    citations={message.parts.flatMap((p) =>
                      p.type === "data-citation" ? [p.data] : [],
                    )}
                    messageId={message.id}
                    threadId={thread.id}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {message.parts
                      .filter((p) => p.type === "text")
                      .map((p) => p.text)
                      .join("")}
                  </p>
                )}
                {message.parts.map((part) =>
                  part.type === "data-attachment" ? (
                    <ChatAttachmentCard key={part.id} attachment={part.data} getToken={getToken} />
                  ) : null,
                )}
                {message.parts.some(
                  (p) =>
                    p.type === "data-run-status" &&
                    !isChatRunActive(p.data.status) &&
                    p.data.status !== "completed",
                ) ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Jawaban terhenti · teks mungkin belum lengkap.
                  </p>
                ) : null}
              </div>
            ))}
            {active && !activeAssistant ? loadingIndicator : null}
            {terminal ? (
              <div className="rounded-xl border p-3 text-xs text-muted-foreground">
                <p>{incompleteRunMessage(terminal.status, terminal.errorCode)}</p>
                {retryMessage ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 text-xs"
                    onClick={() =>
                      void send(
                        terminal.id,
                        retryMessage.parts
                          .filter((p) => p.type === "text")
                          .map((p) => p.text)
                          .join(""),
                        retryMessage.references,
                        retryMessage.contexts[0],
                        retryMessage.mentions,
                        retryMessage.parts.flatMap((p) =>
                          p.type === "data-attachment" ? [p.id] : [],
                        ),
                      )
                    }
                    disabled={active}
                  >
                    Coba ulang
                  </Button>
                ) : null}
              </div>
            ) : null}
            {safeError ? (
              <div role="alert" className="mt-4 text-xs leading-6 text-destructive">
                {safeError}
                <Button
                  variant="link"
                  size="sm"
                  className="block px-0 text-xs"
                  onClick={() => {
                    void history.refetch();
                    if (runId) void run.refetch();
                  }}
                >
                  Muat ulang riwayat
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {!isAtBottom ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute bottom-4 left-1/2 z-10 size-11 -translate-x-1/2 rounded-full border shadow-sm"
            aria-label="Gulir ke pesan terbaru"
            onClick={() => void scrollToBottom()}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <ChatComposer
        attachments={session.attachments}
        onAttachmentsChange={(attachments) => patch({ attachments })}
        draft={draft}
        document={session.document}
        lockedContext={lockedContext}
        root={root}
        getToken={getToken}
        fullPage={fullPage}
        onDraftChange={(draft, document, mentions) => patch({ draft, document, mentions })}
        onSend={() => void send()}
        className={fullPage ? "mx-auto w-full max-w-3xl sm:pb-6" : undefined}
        disabled={history.isPending || history.isError}
        active={active}
        cancelling={cancelling || !runId}
        onCancel={() => void cancel()}
      />
    </>
  );
}

function incompleteRunMessage(status: ChatRunStatus, errorCode: ChatRunError | null): string {
  if (errorCode === "ATTACHMENT_UNREADABLE") {
    return "Lampiran tidak dapat dibaca. Jika XLSX ditolak, ekspor bagian yang diperlukan sebagai CSV atau PDF. Untuk file lain, coba unggah ulang sebagai PDF.";
  }
  if (errorCode === "CONTEXT_LIMIT") {
    return "Pesan dan lampiran melebihi kapasitas konteks. Gunakan file yang lebih kecil atau mulai percakapan baru.";
  }
  if (status === "cancelled") return "Jawaban dihentikan.";
  return "Jawaban belum selesai. Kamu dapat mencoba ulang.";
}
