import {
  type ChatMaterialTarget,
  type ChatThread,
  chatCitationResponseSchema,
  chatMaterialPreviewResponseSchema,
  chatMaterialsResponseSchema,
  chatMessagesResponseSchema,
  chatRunResponseSchema,
  chatThreadResponseSchema,
  chatThreadsResponseSchema,
} from "@ngertiin/contracts/api";
import { requestApi, type TokenResolver } from "../../../lib/api";
export const chatRoot = (moduleId: string) => `/modules/${encodeURIComponent(moduleId)}/chat`;
export function chatApi(token: TokenResolver, moduleId: string) {
  const root = chatRoot(moduleId);
  const thread = (id: string) => `${root}/threads/${encodeURIComponent(id)}`;
  return {
    materials: async (nodeId?: string, after?: string) => {
      const query = new URLSearchParams();
      if (nodeId) query.set("nodeId", nodeId);
      if (after) query.set("after", after);
      return (await requestApi(`${root}/materials?${query}`, token, chatMaterialsResponseSchema))
        .data;
    },
    preview: async (target: ChatMaterialTarget, startCodePoint = 0) =>
      (
        await requestApi(`${root}/materials/preview`, token, chatMaterialPreviewResponseSchema, {
          method: "POST",
          body: JSON.stringify({ target, startCodePoint }),
        })
      ).data,
    citation: async (threadId: string, messageId: string, citationId: string) =>
      (
        await requestApi(
          `${thread(threadId)}/messages/${encodeURIComponent(messageId)}/citations/${encodeURIComponent(citationId)}`,
          token,
          chatCitationResponseSchema,
        )
      ).data,
    list: (cursor?: string) =>
      requestApi(
        `${root}/threads${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        token,
        chatThreadsResponseSchema,
      ),
    get: async (id: string) => (await requestApi(thread(id), token, chatThreadResponseSchema)).data,
    create: async (): Promise<ChatThread> =>
      (
        await requestApi(`${root}/threads`, token, chatThreadResponseSchema, {
          method: "POST",
          body: "{}",
        })
      ).data,
    rename: async (id: string, title: string) =>
      (
        await requestApi(thread(id), token, chatThreadResponseSchema, {
          method: "PATCH",
          body: JSON.stringify({ title }),
        })
      ).data,
    remove: (id: string) =>
      requestApi(thread(id), token, { parse: () => undefined }, { method: "DELETE" }),
    messages: (id: string, cursor?: string) =>
      requestApi(
        `${thread(id)}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        token,
        chatMessagesResponseSchema,
      ),
    run: async (id: string, runId: string) =>
      (
        await requestApi(
          `${thread(id)}/runs/${encodeURIComponent(runId)}`,
          token,
          chatRunResponseSchema,
        )
      ).data,
    cancel: async (id: string, runId: string) =>
      (
        await requestApi(
          `${thread(id)}/runs/${encodeURIComponent(runId)}/cancel`,
          token,
          chatRunResponseSchema,
          { method: "POST", body: "{}" },
        )
      ).data,
  };
}
