import { useAuth } from "@clerk/react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { chatApi } from "./api/chat-api";

export function useChatThreads(moduleId?: string | null) {
  const { getToken, userId } = useAuth();
  const client = useQueryClient();
  const root = useMemo(() => ["chat", userId] as const, [userId]);
  const api = useMemo(() => chatApi(getToken, moduleId), [getToken, moduleId]);
  const threads = useInfiniteQuery({
    queryKey: [...root, "threads", moduleId ?? "all"],
    queryFn: ({ pageParam }) => api.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: Boolean(userId),
  });
  const list = [
    ...new Map(threads.data?.pages.flatMap((p) => p.data).map((t) => [t.id, t])).values(),
  ];
  const refresh = () => client.invalidateQueries({ queryKey: root });
  return { api, root, getToken, threads, list, refresh };
}
