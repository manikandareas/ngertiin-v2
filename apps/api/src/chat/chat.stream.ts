import {
  type ChatCitation,
  type ChatRunError,
  type ChatRunStatus,
  isChatRunActive,
} from "@ngertiin/contracts/api";
import type { UIMessageChunk } from "ai";
import type { ChatStreamEvent, ChatSubscription } from "./chat.pubsub.js";

export type ChatSnapshot = {
  run: {
    id: string;
    assistantMessageId: string | null;
    status: ChatRunStatus;
    errorCode: ChatRunError | null;
  };
  text: string;
  citations?: ChatCitation[];
  sequence: number;
};
export type ChatEventResponse = {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(data: string): boolean;
  readonly writableLength?: number;
  end(): void;
  on(event: "close", listener: () => void): void;
};

export function chatSnapshotFrames(
  snapshot: ChatSnapshot,
  previous?: ChatSnapshot,
): UIMessageChunk[] {
  const { run } = snapshot;
  if (!run.assistantMessageId && isChatRunActive(run.status)) return [];
  const frames: UIMessageChunk[] = [];
  if (!previous?.run.assistantMessageId) {
    frames.push(
      {
        type: "start",
        messageId: run.assistantMessageId ?? run.id,
        messageMetadata: { runId: run.id, status: run.status },
      },
      { type: "text-start", id: "answer" },
    );
  }
  const delta = snapshot.text.slice(previous?.text.length ?? 0);
  if (delta) frames.push({ type: "text-delta", id: "answer", delta });
  for (const citation of snapshot.citations ?? []) {
    if (!previous?.citations?.some((item) => item.id === citation.id))
      frames.push(
        {
          type: "source-document",
          sourceId: citation.id,
          mediaType: "text/plain",
          title: citation.title,
        },
        { type: "data-citation", id: citation.id, data: citation },
      );
  }
  if (!isChatRunActive(run.status)) {
    frames.push(
      { type: "text-end", id: "answer" },
      { type: "data-run-status", data: { status: run.status, errorCode: run.errorCode } },
    );
    if (["failed", "timed_out", "interrupted"].includes(run.status))
      frames.push({ type: "error", errorText: "Jawaban belum dapat diselesaikan." });
    frames.push({ type: "finish", messageMetadata: { runId: run.id, status: run.status } });
  }
  return frames;
}

/** Subscribe before loading the committed snapshot; discard overlapping deltas. */
export async function streamChatSnapshots(
  res: ChatEventResponse,
  read: () => Promise<ChatSnapshot>,
  subscribe: ChatSubscription,
  maxBufferBytes: number,
  checkIntervalMs: number,
  authorize?: () => Promise<void>,
): Promise<void> {
  let closed = false;
  let ready = false;
  let sequence = -1;
  let bufferedBytes = 0;
  const pending: ChatStreamEvent[] = [];
  let unsubscribe: (() => void) | undefined;
  let subscriptionReady = false;
  let subscriptionLost = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    unsubscribe?.();
    pending.length = 0;
    res.end();
  };
  res.on("close", close);
  const write = (data: string) => {
    if (closed) return;
    if ((res.writableLength ?? 0) + Buffer.byteLength(data) > maxBufferBytes) return close();
    // A full Node write buffer is already a slow subscriber; never await drain.
    if (!res.write(data)) close();
  };
  const emit = (frames: UIMessageChunk[]) => {
    for (const frame of frames) {
      write(`data: ${JSON.stringify(frame)}\n\n`);
      if (frame.type === "finish") {
        write("data: [DONE]\n\n");
        close();
      }
    }
  };
  let delivering = false;
  const drain = async () => {
    if (delivering || !ready || closed) return;
    delivering = true;
    try {
      while (pending.length && !closed) {
        const event = pending.shift();
        if (!event) break;
        const eventBytes = Buffer.byteLength(JSON.stringify(event));
        if (event.sequence <= sequence) {
          bufferedBytes -= eventBytes;
          continue;
        }
        if (event.sequence !== sequence + 1) {
          close();
          break;
        }
        await authorize?.();
        if (closed) break;
        sequence = event.sequence;
        emit(event.frames);
        bufferedBytes -= eventBytes;
      }
    } catch {
      close();
    } finally {
      delivering = false;
    }
  };
  const receive = (event: ChatStreamEvent) => {
    if (closed || event.sequence <= sequence) return;
    bufferedBytes += Buffer.byteLength(JSON.stringify(event));
    if (bufferedBytes > maxBufferBytes) return close();
    pending.push(event);
    void drain();
  };
  try {
    unsubscribe = await subscribe(receive, () => {
      subscriptionLost = true;
      if (subscriptionReady) close();
    });
    subscriptionReady = true;
    if (subscriptionLost) close();
    if (closed) {
      unsubscribe();
      return;
    }
    const initial = await read();
    if (closed) return;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-cache, no-store, no-transform");
    res.setHeader("x-vercel-ai-ui-message-stream", "v1");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    sequence = initial.sequence;
    emit(chatSnapshotFrames(initial));
    ready = true;
    await drain();
    if (closed) return;
    let checking = false;
    timer = setInterval(() => {
      if (checking || closed || delivering) return;
      checking = true;
      // Detect a lost final publication even when there is no next delta to expose a gap.
      void read()
        .then((snapshot) => {
          if (closed || delivering) return;
          if (snapshot.sequence > sequence || !isChatRunActive(snapshot.run.status)) close();
          else write(": keepalive\n\n");
        })
        .catch(close)
        .finally(() => {
          checking = false;
        });
    }, checkIntervalMs);
    timer.unref();
  } catch (error) {
    unsubscribe?.();
    if (ready || closed) close();
    else throw error;
  }
}
