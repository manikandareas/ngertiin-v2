import { useChat } from "@ai-sdk/react";
import { Attachment01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type ChatAcknowledgment,
  type ChatPageContext,
  type ChatThread,
  chatCitationSchema,
  chatRunDataSchema,
  isChatRunActive,
} from "@ngertiin/contracts/api";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "../../../components/ui/button";
import { ApiProblemError, type TokenResolver } from "../../../lib/api";
import type { chatApi } from "../api/chat-api";
import { createChatTransport, type LearningMessage, toUIMessage } from "../api/chat-transport";
import { ChatCitedAnswer } from "./chat-citation";
import { ChatComposer } from "./chat-composer";
import { ChatContextPicker, type SelectedChatExcerpt } from "./chat-context-picker";
import { ChatMascot } from "./chat-mascot";
import { ChatWelcome } from "./chat-welcome";

export function ChatConversation({
  thread,
  api,
  root,
  getToken,
  moduleId,
  pageContext,
  contextLabel = "Modul ini",
  initialMessage,
  onInitialMessageConsumed,
}: {
  thread: ChatThread;
  api: ReturnType<typeof chatApi>;
  root: readonly unknown[];
  getToken: TokenResolver;
  moduleId: string;
  pageContext: ChatPageContext;
  contextLabel?: string;
  initialMessage?: string;
  onInitialMessageConsumed?: () => void;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState(initialMessage ?? "");
  const initialSent = useRef(false);
  const [excerpts, setExcerpts] = useState<SelectedChatExcerpt[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const attachButton = useRef<HTMLSpanElement>(null);
  const [ack, setAck] = useState<ChatAcknowledgment | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const pending = useRef<{
    key: string;
    text: string;
    pageContext: ChatPageContext;
    retryOfRunId?: string;
    references: SelectedChatExcerpt["reference"][];
  } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: root });
  }, [client, root]);
  const onAccepted = useCallback(
    (value: ChatAcknowledgment) => {
      setAck(value);
      setObservedRunId(value.runId);
      setDraft((current) => (current.trim() === pending.current?.text ? "" : current));
      setExcerpts([]);
      refresh();
    },
    [refresh],
  );
  const transport = useMemo(
    () => createChatTransport({ moduleId, threadId: thread.id, token: getToken, onAccepted }),
    [moduleId, thread.id, getToken, onAccepted],
  );
  const chat = useChat<LearningMessage>({
    id: thread.id,
    transport,
    dataPartSchemas: { "run-status": chatRunDataSchema, citation: chatCitationSchema },
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
  const active = streaming || Boolean(runId && (!run.data || isChatRunActive(run.data.status)));
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
  const textSize = messages.reduce(
    (n, m) =>
      n + m.parts.filter((p) => p.type === "text").reduce((size, p) => size + p.text.length, 0),
    0,
  );
  useLayoutEffect(() => {
    if (textSize > 0 && followBottom.current && bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [textSize]);
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
    sentPageContext = pageContext,
  ) {
    const trimmed = text.trim();
    if (!trimmed || active || history.isPending || history.isError) return;
    setActionError(null);
    chat.clearError();
    followBottom.current = true;
    if (
      !pending.current ||
      pending.current.text !== trimmed ||
      JSON.stringify(pending.current.pageContext) !== JSON.stringify(sentPageContext) ||
      pending.current.retryOfRunId !== retryOfRunId ||
      JSON.stringify(pending.current.references) !== JSON.stringify(references) ||
      ack
    ) {
      pending.current = {
        key: crypto.randomUUID(),
        text: trimmed,
        pageContext: sentPageContext,
        retryOfRunId,
        references,
      };
    }
    setAck(null);
    await chat.sendMessage(
      { text: trimmed },
      {
        body: {
          pageContext: sentPageContext,
          retryOfRunId,
          references: pending.current.references,
          idempotencyKey: pending.current.key,
        },
      },
    );
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
    onInitialMessageConsumed?.();
    void send();
  });
  useEffect(() => {
    if (initialMessage && history.isSuccess && !initialSent.current) {
      initialSent.current = true;
      sendInitial();
    }
  }, [initialMessage, history.isSuccess]);
  const retryMessage = terminal
    ? saved.find((m) => m.id === terminal.messageId && m.availability === "available")
    : undefined;
  return (
    <>
      <div
        ref={bodyRef}
        onWheel={(event) => {
          if (event.deltaY < 0) followBottom.current = false;
        }}
        onTouchMove={() => {
          followBottom.current = false;
        }}
        onPointerDown={() => {
          followBottom.current = false;
        }}
        onKeyDown={(event) => {
          if (["ArrowUp", "PageUp", "Home"].includes(event.key)) followBottom.current = false;
        }}
        onScroll={() => {
          const body = bodyRef.current;
          if (body && body.scrollHeight - body.scrollTop - body.clientHeight < 40)
            followBottom.current = true;
        }}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-4 pt-5 [&>*]:shrink-0"
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
              followBottom.current = false;
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
                ? "mb-6 ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-muted px-4 py-3 text-sm leading-7"
                : "mb-7 text-sm leading-7"
            }
          >
            {message.role === "assistant" ? (
              <div className="mb-3 flex items-center gap-2 text-xs font-bold">
                <ChatMascot className="size-7" />
                Teman belajar
              </div>
            ) : null}
            {message.role === "assistant" ? (
              <ChatCitedAnswer
                isAnimating={active && message.metadata?.runId === runId}
                text={message.parts
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("")}
                citations={message.parts.flatMap((p) =>
                  p.type === "data-citation" ? [p.data] : [],
                )}
                messageId={message.id}
                threadId={thread.id}
                api={api}
              />
            ) : (
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {message.parts
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("")}
              </p>
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
        {active ? (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <ChatMascot className="size-7" thinking />
            {run.data?.status === "cancelling"
              ? "Menghentikan jawaban…"
              : "Teman belajar sedang menjawab…"}
          </p>
        ) : null}
        {terminal ? (
          <div className="rounded-xl border p-3 text-xs text-muted-foreground">
            <p>
              {terminal.status === "cancelled"
                ? "Jawaban dihentikan."
                : "Jawaban belum selesai. Kamu dapat mencoba ulang."}
            </p>
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
                    retryMessage.contexts[0] ?? pageContext,
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
      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSend={() => void send()}
        contextLabel={contextLabel}
        disabled={history.isPending || history.isError}
        active={active}
        cancelling={cancelling || !runId}
        onCancel={() => void cancel()}
        attachments={
          excerpts.length ? (
            <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
              {excerpts.map((item, index) => (
                <div
                  key={JSON.stringify(item.reference)}
                  className="flex items-start gap-2 rounded-xl bg-accent/50 p-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">{item.excerpt}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    aria-label="Hapus kutipan"
                    disabled={active}
                    onClick={() => setExcerpts((items) => items.filter((_, i) => i !== index))}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null
        }
        attachAction={
          <span ref={attachButton}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-1 text-xs font-semibold normal-case text-muted-foreground"
              disabled={active}
              onClick={() => setPickerOpen(true)}
            >
              <HugeiconsIcon icon={Attachment01Icon} strokeWidth={1.5} aria-hidden="true" />
              Kutip materi
            </Button>
          </span>
        }
      />
      {pickerOpen ? (
        <ChatContextPicker
          api={api}
          root={root}
          pageContext={pageContext}
          onClose={() => setPickerOpen(false)}
          returnFocus={() => attachButton.current?.querySelector("button")?.focus()}
          onSelect={(excerpt) => {
            setExcerpts((items) => [
              ...items.filter(
                (item) => JSON.stringify(item.reference) !== JSON.stringify(excerpt.reference),
              ),
              excerpt,
            ]);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
