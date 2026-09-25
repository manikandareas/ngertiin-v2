import {
  type ChatActivity,
  type ChatCitation,
  type ChatImage,
  type ChatInteraction,
  type ChatRunError,
  type ChatRunStatus,
  type ChatWebSearchState,
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
  activities?: ChatActivity[];
  citations?: ChatCitation[];
  images?: ChatImage[];
  interactions?: ChatInteraction[];
  practices?: Array<{
    practiceId: string;
    moduleId: string;
    status: "generating" | "ready" | "failed";
  }>;
  webSearch?: ChatWebSearchState;
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
  if (
    snapshot.webSearch &&
    (snapshot.webSearch.status !== previous?.webSearch?.status ||
      snapshot.webSearch.searches !== previous?.webSearch?.searches)
  )
    frames.push({ type: "data-web-search", id: "web-search", data: snapshot.webSearch });
  for (const activity of snapshot.activities ?? []) {
    const existing = previous?.activities?.find((item) => item.id === activity.id);
    if (JSON.stringify(existing) !== JSON.stringify(activity))
      frames.push({ type: "data-activity", id: activity.id, data: activity });
  }
  for (const citation of snapshot.citations ?? []) {
    const existing = previous?.citations?.find((item) => item.id === citation.id);
    if (!existing)
      frames.push(
        citation.origin === "web"
          ? {
              type: "source-url",
              sourceId: citation.id,
              url: citation.url,
              title: citation.title,
            }
          : {
              type: "source-document",
              sourceId: citation.id,
              mediaType: "text/plain",
              title: citation.title,
            },
      );
    if (JSON.stringify(existing) !== JSON.stringify(citation))
      frames.push({ type: "data-citation", id: citation.id, data: citation });
  }
  for (const image of snapshot.images ?? []) {
    if (!previous?.images?.some((item) => item.id === image.id))
      frames.push({ type: "data-image", id: image.id, data: image });
  }
  for (const interaction of snapshot.interactions ?? []) {
    const existing = previous?.interactions?.find((item) => item.id === interaction.id);
    if (JSON.stringify(existing) !== JSON.stringify(interaction))
      frames.push({ type: "data-interaction", id: interaction.id, data: interaction });
  }
  for (const practice of snapshot.practices ?? []) {
    if (
      !previous?.practices?.some(
        (item) => item.practiceId === practice.practiceId && item.status === practice.status,
      )
    )
      frames.push({ type: "data-practice", id: practice.practiceId, data: practice });
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
  let delivered: ChatSnapshot | undefined;
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
  const deliver = (snapshot: ChatSnapshot) => {
    if (closed || snapshot.sequence <= sequence) return;
    // Public answer text is append-only. Never stitch incompatible snapshots together.
    if (delivered && !snapshot.text.startsWith(delivered.text)) return close();
    const frames = chatSnapshotFrames(snapshot, delivered);
    sequence = snapshot.sequence;
    delivered = snapshot;
    emit(frames);
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
        await authorize?.();
        // Redis is a wake-up signal. Read the authorized, committed snapshot to
        // coalesce updates and recover missed/out-of-order publications safely.
        const snapshot = await read();
        if (closed) break;
        if (snapshot.sequence < event.sequence) {
          close();
          break;
        }
        deliver(snapshot);
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
    deliver(initial);
    ready = true;
    await drain();
    if (closed) return;
    timer = setInterval(() => {
      if (closed || delivering) return;
      delivering = true;
      // Share the delivery lock with Pub/Sub so a delayed DB read cannot race
      // a newer event or append the same text twice.
      void (async () => {
        await authorize?.();
        const snapshot = await read();
        deliver(snapshot);
        if (!closed) write(": keepalive\n\n");
      })()
        .catch(close)
        .finally(() => {
          delivering = false;
          void drain();
        });
    }, checkIntervalMs);
    timer.unref();
  } catch (error) {
    unsubscribe?.();
    if (ready || closed) close();
    else throw error;
  }
}
