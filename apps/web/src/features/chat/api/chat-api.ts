import {
  type ChatMaterialTarget,
  type ChatThread,
  chatAttachmentDownloadSchema,
  chatAttachmentResponseSchema,
  chatCitationResponseSchema,
  chatImageDownloadSchema,
  chatMaterialPreviewResponseSchema,
  chatMaterialsResponseSchema,
  chatMessagesResponseSchema,
  chatRunResponseSchema,
  chatThreadResponseSchema,
  chatThreadsResponseSchema,
} from "@ngertiin/contracts/api";
import { requestApi, type TokenResolver } from "../../../lib/api";
export const chatRoot = () => "/chat";
export function chatApi(token: TokenResolver, moduleId?: string | null) {
  const root = chatRoot();
  const materialsRoot = () => {
    if (!moduleId) throw new Error("Pilih modul untuk membaca materi.");
    return `/modules/${encodeURIComponent(moduleId)}/chat`;
  };
  const thread = (id: string) => `${root}/threads/${encodeURIComponent(id)}`;
  return {
    upload: async (file: File, signal?: AbortSignal) => {
      const body = new FormData();
      body.set("file", file);
      return (
        await requestApi(`${root}/attachments`, token, chatAttachmentResponseSchema, {
          method: "POST",
          body,
          signal,
        })
      ).data;
    },
    removeAttachment: (id: string) =>
      requestApi(
        `${root}/attachments/${encodeURIComponent(id)}`,
        token,
        { parse: () => undefined },
        { method: "DELETE" },
      ),
    downloadAttachment: async (id: string) =>
      (
        await requestApi(
          `${root}/attachments/${encodeURIComponent(id)}/download`,
          token,
          chatAttachmentDownloadSchema,
          { cache: "no-store" },
        )
      ).data,

    materials: async (nodeId?: string, after?: string) => {
      const query = new URLSearchParams();
      if (nodeId) query.set("nodeId", nodeId);
      if (after) query.set("after", after);
      return (
        await requestApi(
          `${materialsRoot()}/materials?${query}`,
          token,
          chatMaterialsResponseSchema,
        )
      ).data;
    },
    preview: async (target: ChatMaterialTarget, startCodePoint = 0) =>
      (
        await requestApi(
          `${materialsRoot()}/materials/preview`,
          token,
          chatMaterialPreviewResponseSchema,
          {
            method: "POST",
            body: JSON.stringify({ target, startCodePoint }),
          },
        )
      ).data,
    citation: async (threadId: string, messageId: string, citationId: string) =>
      (
        await requestApi(
          `${thread(threadId)}/messages/${encodeURIComponent(messageId)}/citations/${encodeURIComponent(citationId)}`,
          token,
          chatCitationResponseSchema,
        )
      ).data,
    image: async (threadId: string, messageId: string, imageId: string) =>
      (
        await requestApi(
          `${thread(threadId)}/messages/${encodeURIComponent(messageId)}/images/${encodeURIComponent(imageId)}`,
          token,
          chatImageDownloadSchema,
          { cache: "no-store" },
        )
      ).data.url,
    list: (cursor?: string) =>
      requestApi(
        `${root}/threads?${new URLSearchParams({ ...(moduleId ? { moduleId } : {}), ...(cursor ? { cursor } : {}) })}`,
        token,
        chatThreadsResponseSchema,
      ),
    get: async (id: string) => (await requestApi(thread(id), token, chatThreadResponseSchema)).data,
    create: async (title?: string): Promise<ChatThread> =>
      (
        await requestApi(`${root}/threads`, token, chatThreadResponseSchema, {
          method: "POST",
          body: JSON.stringify({ moduleId: moduleId ?? null, title }),
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
