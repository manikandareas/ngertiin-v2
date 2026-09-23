import {
  type ChatAcknowledgment,
  type ChatAttachment,
  type ChatCitation,
  type ChatImage,
  type ChatMessage,
  type ChatPageContext,
  type ChatRunStatus,
  type ChatWebSearchState,
  chatSendResponseSchema,
  sendChatMessageSchema,
} from "@ngertiin/contracts/api";
import {
  type ChatTransport,
  parseJsonEventStream,
  type UIMessage,
  type UIMessageChunk,
  uiMessageChunkSchema,
} from "ai";
import { webEnvironment } from "../../../config";
import { requestApi, type TokenResolver } from "../../../lib/api";
import { chatRoot } from "./chat-api";
export type LearningMessage = UIMessage<
  { runId: string; status?: ChatRunStatus },
  {
    attachment: ChatAttachment;
    "run-status": { status: ChatRunStatus; errorCode: string | null };
    citation: ChatCitation;
    image: ChatImage;
    "web-search": ChatWebSearchState;
  }
>;
export function toUIMessage(message: ChatMessage): LearningMessage {
  const status = message.parts.find((p) => p.type === "data-run-status");
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.flatMap((part): LearningMessage["parts"] => {
      if (part.type !== "data-citation") return [part];
      const citation = part.data;
      if (citation.origin === "web") {
        return [
          { type: "source-url", sourceId: citation.id, url: citation.url, title: citation.title },
          part,
        ];
      }
      return [
        {
          type: "source-document",
          sourceId: citation.id,
          mediaType: "text/plain",
          title: citation.title,
        },
        part,
      ];
    }),
    metadata: {
      runId: message.runId,
      status: status?.type === "data-run-status" ? status.data.status : undefined,
    },
  };
}
export function createChatTransport(options: {
  threadId: string;
  token: TokenResolver;
  onAccepted: (ack: ChatAcknowledgment) => void;
}): ChatTransport<LearningMessage> {
  return {
    async sendMessages({ messages, body: rawBody, abortSignal }) {
      const body = rawBody as Record<string, unknown> | undefined;
      const input = sendChatMessageSchema.parse({
        text: messages
          .at(-1)
          ?.parts.filter((p) => p.type === "text")
          .map((p) => p.text)
          .join(""),
        pageContext: body?.pageContext as ChatPageContext | undefined,
        retryOfRunId: body?.retryOfRunId,
        references: body?.references,
        mentions: body?.mentions,
        attachmentIds: body?.attachmentIds,
      });
      const key =
        typeof body?.idempotencyKey === "string" ? body.idempotencyKey : crypto.randomUUID();
      const response = await requestApi(
        `${chatRoot()}/threads/${options.threadId}/messages`,
        options.token,
        chatSendResponseSchema,
        {
          method: "POST",
          body: JSON.stringify(input),
          headers: { "Idempotency-Key": key },
        },
      );
      options.onAccepted(response.data);
      const token = await options.token();
      if (!token) throw new Error("Sesi berakhir. Masuk kembali untuk membaca jawaban.");
      const expected = `/api/v1${chatRoot()}/threads/${options.threadId}/runs/${response.data.runId}/events`;
      if (response.data.eventsUrl !== expected) throw new Error("Alamat stream tidak valid.");
      const stream = await fetch(`${webEnvironment.VITE_API_URL}${expected}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        signal: abortSignal,
      });
      if (!stream.ok || !stream.body)
        throw new Error("Koneksi streaming terputus. Jawaban akan dibaca dari riwayat.");
      let finished = false;
      return parseJsonEventStream({
        stream: stream.body,
        schema: uiMessageChunkSchema,
      }).pipeThrough(
        new TransformStream({
          transform(chunk, controller: TransformStreamDefaultController<UIMessageChunk>) {
            if (!chunk.success) throw chunk.error;
            if (chunk.value.type === "finish") finished = true;
            controller.enqueue(chunk.value);
          },
          flush() {
            if (!finished)
              throw new Error("Koneksi streaming terputus. Jawaban akan dibaca dari riwayat.");
          },
        }),
      );
    },
    // Reopening a sidebar reads durable history/status, never sends the message again.
    async reconnectToStream() {
      return null;
    },
  };
}
