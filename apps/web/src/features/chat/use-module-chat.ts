import { useAuth } from "@clerk/react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { chatApi } from "./api/chat-api";
export function useModuleChat(moduleId: string) {
  const { getToken, userId } = useAuth();
  const client = useQueryClient();
  const root = useMemo(() => ["chat", userId, moduleId] as const, [userId, moduleId]);
  const selectionKey = [...root, "selection"] as const;
  const { data: selection } = useQuery({
    queryKey: selectionKey,
    queryFn: () => ({ threadId: null as string | null, open: true }),
    initialData: { threadId: null as string | null, open: true },
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
  const select = (threadId: string | null) =>
    client.setQueryData(selectionKey, { ...selection, threadId });
  const toggle = (open: boolean) => client.setQueryData(selectionKey, { ...selection, open });
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
    toggle,
    refresh,
  };
}
