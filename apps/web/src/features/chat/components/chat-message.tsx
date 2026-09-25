import {
  type ChatRun,
  isChatRunActive,
  type RespondChatInteraction,
} from "@ngertiin/contracts/api";
import type { TokenResolver } from "../../../lib/api";
import type { chatApi } from "../api/chat-api";
import type { LearningMessage } from "../api/chat-transport";
import { ChatActivityTrace } from "./chat-activity-trace";
import { ChatAttachmentCard } from "./chat-attachment-card";
import { ChatCitedAnswer } from "./chat-citation";
import { ChatInteractionCard } from "./chat-interaction-card";
import { ChatPracticeCard } from "./chat-practice-card";

type ChatMessageProps = {
  message: LearningMessage;
  active: boolean;
  fullPage: boolean;
  run: ChatRun | undefined;
  threadId: string;
  api: ReturnType<typeof chatApi>;
  getToken: TokenResolver;
  onRespond: (
    runId: string,
    interactionId: string,
    decision: RespondChatInteraction,
  ) => Promise<void>;
};

export function ChatMessage({
  message,
  active,
  fullPage,
  run,
  threadId,
  api,
  getToken,
  onRespond,
}: ChatMessageProps) {
  return (
    <div
      className={
        message.role === "user"
          ? `ml-auto max-w-[90%] rounded-2xl bg-[var(--chat-user-bubble)] px-4 py-2.5 text-base leading-8 ${fullPage ? "mb-10" : "mb-6 rounded-br-sm"}`
          : `${fullPage ? "mb-10" : "mb-7"} text-base leading-8`
      }
    >
      {message.role === "assistant" ? (
        <ChatActivityTrace
          activities={message.parts.flatMap((part) =>
            part.type === "data-activity" ? [part.data] : [],
          )}
          interactions={message.parts.flatMap((part) =>
            part.type === "data-interaction" ? [part.data] : [],
          )}
          active={active}
          status={
            message.metadata?.status && !isChatRunActive(message.metadata.status)
              ? message.metadata.status
              : message.metadata?.runId === run?.id
                ? run?.status
                : message.metadata?.status
          }
          hasText={message.parts.some((part) => part.type === "text" && Boolean(part.text))}
        />
      ) : null}
      {message.role === "assistant" ? (
        <ChatCitedAnswer
          isAnimating={active}
          text={message.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("")}
          citations={message.parts.flatMap((p) => (p.type === "data-citation" ? [p.data] : []))}
          images={message.parts.flatMap((p) => (p.type === "data-image" ? [p.data] : []))}
          loadImage={(id) => api.image(threadId, message.id, id)}
          messageId={message.id}
          threadId={threadId}
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
        ) : part.type === "data-interaction" && part.data.status === "pending" ? (
          <ChatInteractionCard
            key={part.id}
            interaction={part.data}
            onRespond={async (decision) => {
              if (!part.id || !message.metadata?.runId)
                throw new Error("Identitas interaksi tidak tersedia.");
              await onRespond(message.metadata.runId, part.id, decision);
            }}
          />
        ) : part.type === "data-practice" ? (
          <ChatPracticeCard
            key={part.id}
            practiceId={part.data.practiceId}
            moduleId={part.data.moduleId}
            getToken={getToken}
          />
        ) : null,
      )}
      {message.parts.some(
        (p) =>
          p.type === "data-run-status" &&
          !isChatRunActive(p.data.status) &&
          p.data.status !== "completed" &&
          p.data.status !== "waiting_for_input",
      ) ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Jawaban terhenti · teks mungkin belum lengkap.
        </p>
      ) : null}
    </div>
  );
}
