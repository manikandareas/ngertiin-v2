import {
  type ChatMention,
  type ChatScope,
  chatMessageScopeSchema,
  type SendChatMessage,
} from "@ngertiin/contracts/api";

/** Resolve once at admission; a queued run and its retries keep this exact scope. */
export function resolveMessageScope(
  input: SendChatMessage,
  previous: unknown,
  retry: unknown,
  legacyScope: ChatScope | undefined,
): { mentions: ChatMention[]; scopes: ChatScope[] } {
  if (retry) return chatMessageScopeSchema.parse(retry);
  const mentions = input.mentions ?? [];
  if (mentions.length) {
    const scopes = [
      ...new Map(
        mentions.map(({ moduleId, nodeId }) => [
          `${moduleId}:${nodeId ?? ""}`,
          { moduleId, ...(nodeId ? { nodeId } : {}) },
        ]),
      ).values(),
    ];
    return { mentions, scopes };
  }
  if (previous) return { mentions, scopes: chatMessageScopeSchema.parse(previous).scopes };
  return { mentions, scopes: legacyScope ? [legacyScope] : [] };
}
