import type {
  ChatAcknowledgment,
  ChatAttachment,
  ChatContextReference,
  ChatMention,
  ChatPageContext,
} from "@ngertiin/contracts/api";
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { useCallback } from "react";

type SelectedChatExcerpt = { reference: ChatContextReference; title: string; excerpt: string };

export type PendingChatMessage = {
  key: string;
  attachmentIds: string[];
  mentions: ChatMention[];
  text: string;
  pageContext?: ChatPageContext;
  retryOfRunId?: string;
  references: SelectedChatExcerpt["reference"][];
};
export type ChatSession = {
  attachments: ChatAttachment[];
  draft: string;
  document?: JSONContent;
  mentions: ChatMention[];
  contextSeeded?: boolean;
  excerpts: SelectedChatExcerpt[];
  pending: { current: PendingChatMessage | null };
  ack: ChatAcknowledgment | null;
  sending: boolean;
  autoSend: boolean;
  pageContext?: ChatPageContext;
};
const emptySession = (): ChatSession => ({
  draft: "",
  attachments: [],
  mentions: [],
  excerpts: [],
  pending: { current: null },
  ack: null,
  sending: false,
  autoSend: false,
});
const sessionKey = (root: readonly unknown[], id: string) => [...root, "session", id];

export function patchChatSession(
  client: QueryClient,
  root: readonly unknown[],
  id: string,
  patch: Partial<ChatSession>,
) {
  client.setQueryData<ChatSession>(sessionKey(root, id), (current) => ({
    ...emptySession(),
    ...current,
    ...patch,
  }));
}

/** Account-owned QueryClient keeps drafts during route changes and drops them on logout. */
export function useChatSession(root: readonly unknown[], id: string) {
  const client = useQueryClient();
  const { data: session } = useQuery({
    queryKey: sessionKey(root, id),
    queryFn: emptySession,
    initialData: emptySession,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const patch = useCallback(
    (value: Partial<ChatSession>) => patchChatSession(client, root, id, value),
    [client, root, id],
  );
  const setDraft = useCallback(
    (value: string | ((previous: string) => string)) => {
      client.setQueryData<ChatSession>(sessionKey(root, id), (current) => {
        const previous = current ?? emptySession();
        const draft = typeof value === "function" ? value(previous.draft) : value;
        return draft === previous.draft
          ? previous
          : { ...previous, draft, document: undefined, mentions: [] };
      });
    },
    [client, root, id],
  );
  const setExcerpts = useCallback(
    (
      value: SelectedChatExcerpt[] | ((previous: SelectedChatExcerpt[]) => SelectedChatExcerpt[]),
    ) => {
      client.setQueryData<ChatSession>(sessionKey(root, id), (current) => {
        const previous = current ?? emptySession();
        return {
          ...previous,
          excerpts: typeof value === "function" ? value(previous.excerpts) : value,
        };
      });
    },
    [client, root, id],
  );
  return { session, patch, setDraft, setExcerpts };
}
