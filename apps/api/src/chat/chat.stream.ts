import { isChatRunActive } from "@ngertiin/contracts/api";
import type { UIMessageChunk } from "ai";
import type { ChatService } from "./chat.service.js";

export type ChatEventResponse = {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(data: string): boolean;
  end(): void;
  on(event: "close", listener: () => void): void;
};

/** Deliver committed snapshots; disconnecting never cancels the durable run. */
export async function streamChatSnapshots(
  res: ChatEventResponse,
  read: () => ReturnType<ChatService["streamSnapshot"]>,
) {
  const initial = await read();
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-cache, no-store, no-transform");
  res.setHeader("x-vercel-ai-ui-message-stream", "v1");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  let closed = false,
    started = false,
    text = "",
    polling = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    res.end();
  };
  res.on("close", close);
  const write = (frame: UIMessageChunk) => {
    if (!closed && !res.write(`data: ${JSON.stringify(frame)}\n\n`)) close();
  };
  const emit = (snapshot: Awaited<ReturnType<typeof read>>) => {
    if (closed) return;
    const { run } = snapshot;
    if (!started && (run.assistantMessageId || !isChatRunActive(run.status))) {
      started = true;
      write({
        type: "start",
        messageId: run.assistantMessageId ?? run.id,
        messageMetadata: { runId: run.id, status: run.status },
      });
      write({ type: "text-start", id: "answer" });
    }
    if (started) {
      if (!snapshot.text.startsWith(text)) {
        close();
        return;
      }
      const delta = snapshot.text.slice(text.length);
      if (delta) write({ type: "text-delta", id: "answer", delta });
      text = snapshot.text;
    }
    if (!isChatRunActive(run.status)) {
      write({ type: "text-end", id: "answer" });
      write({ type: "data-run-status", data: { status: run.status, errorCode: run.errorCode } });
      if (["failed", "timed_out", "interrupted"].includes(run.status))
        write({ type: "error", errorText: "Jawaban belum dapat diselesaikan." });
      write({ type: "finish", messageMetadata: { runId: run.id, status: run.status } });
      if (!closed) res.write("data: [DONE]\n\n");
      close();
    }
  };
  emit(initial);
  if (closed) return;
  timer = setInterval(() => {
    if (polling || closed) return;
    polling = true;
    void read()
      .then(emit)
      .catch(close)
      .finally(() => {
        polling = false;
      });
  }, 500);
  timer.unref();
}
