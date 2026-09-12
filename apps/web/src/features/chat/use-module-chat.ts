import { useAuth } from "@clerk/react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { chatApi } from "./api/chat-api";

export type ChatLayout = "sidebar" | "floating";
type ChatSelection = { threadId: string | null; open: boolean; layout: ChatLayout };
const initialSelection: ChatSelection = { threadId: null, open: false, layout: "sidebar" };
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
  const { getToken, userId } = useAuth();
  const client = useQueryClient();
  const root = useMemo(() => ["chat", userId, moduleId] as const, [userId, moduleId]);
  const selectionKey = [...root, "selection"] as const;
  const { data: selection } = useQuery({
    queryKey: selectionKey,
    queryFn: getInitialSelection,
    initialData: getInitialSelection,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const api = useMemo(() => chatApi(getToken, moduleId), [getToken, moduleId]);
  const threads = useInfiniteQuery({
    queryKey: [...root, "threads"],
    queryFn: ({ pageParam }) => api.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: Boolean(userId && moduleId),
  });
  const list = [
    ...new Map(threads.data?.pages.flatMap((p) => p.data).map((t) => [t.id, t])).values(),
  ];
  const selectedId = selection.threadId ?? list[0]?.id ?? null;
  const updateSelection = (patch: Partial<ChatSelection>) =>
    client.setQueryData<ChatSelection>(selectionKey, (current) => ({
      ...initialSelection,
      ...current,
      ...patch,
    }));
  const select = (threadId: string | null) => updateSelection({ threadId });
  const setLayout = (layout: ChatLayout) => {
    updateSelection({ layout });
    try {
      localStorage.setItem(layoutStorageKey, layout);
    } catch {
      // Layout changes still work when browser storage is unavailable.
    }
  };
  const toggle = (open: boolean) => updateSelection({ open });
  const refresh = () => client.invalidateQueries({ queryKey: root });
  return {
    api,
    root,
    getToken,
    threads,
    list,
    selectedId,
    select,
    open: selection.open,
    layout: selection.layout,
    setLayout,
    toggle,
    refresh,
  };
}
