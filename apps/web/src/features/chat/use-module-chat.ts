import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useChatThreads } from "./use-chat-threads";

export type ChatLayout = "sidebar" | "floating";
type ChatSelection = { threadId: string | null; open: boolean; layout: ChatLayout };
export const initialSelection: ChatSelection = { threadId: null, open: false, layout: "sidebar" };
const layoutStorageKey = "ngertiin:chat-layout:v1";

function getInitialSelection(): ChatSelection {
  try {
    const layout = localStorage.getItem(layoutStorageKey);
    if (layout === "sidebar" || layout === "floating") {
      return { ...initialSelection, layout };
    }
  } catch {
    // Keep the default when browser storage is unavailable.
  }
  return initialSelection;
}

export function useModuleChat(moduleId: string) {
  const chat = useChatThreads(moduleId);
  const { root, list } = chat;
  const client = useQueryClient();
  const selectionKey = [...root, "selection", moduleId] as const;
  const { data: selection } = useQuery({
    queryKey: selectionKey,
    queryFn: getInitialSelection,
    initialData: getInitialSelection,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const selectedId =
    selection.threadId === "new" ? null : (selection.threadId ?? list[0]?.id ?? null);
  useEffect(() => {
    if (selection.open && selection.threadId === null && selectedId) {
      client.setQueryData<ChatSelection>([...root, "selection", moduleId], (previous) => ({
        ...initialSelection,
        ...previous,
        threadId: selectedId,
      }));
    }
  }, [client, root, moduleId, selection.open, selection.threadId, selectedId]);
  const updateSelection = (patch: Partial<ChatSelection>) =>
    client.setQueryData<ChatSelection>(selectionKey, (current) => ({
      ...initialSelection,
      ...current,
      ...patch,
    }));
  const select = (threadId: string | null) => updateSelection({ threadId: threadId ?? "new" });
  const setLayout = (layout: ChatLayout) => {
    updateSelection({ layout });
    try {
      localStorage.setItem(layoutStorageKey, layout);
    } catch {
      // Layout changes still work when browser storage is unavailable.
    }
  };
  const toggle = (open: boolean) => updateSelection({ open });
  return {
    ...chat,
    selectedId,
    select,
    open: selection.open,
    layout: selection.layout,
    setLayout,
    toggle,
  };
}
