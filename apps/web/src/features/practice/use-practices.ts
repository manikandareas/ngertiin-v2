import { useAuth } from "@clerk/react";
import type { PracticeSummary } from "@ngertiin/contracts/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { practiceApi } from "./practice-api";

type PracticeFilters = {
  collection: "active" | "archived";
  q: string;
  kind: "" | PracticeSummary["kind"];
};

export function usePractices(moduleId: string | undefined, filters: PracticeFilters) {
  const { getToken, userId } = useAuth();
  const api = practiceApi(getToken);
  return useInfiniteQuery({
    queryKey: ["practices", moduleId, userId, filters],
    queryFn: ({ pageParam }) =>
      api.list(moduleId ?? "", {
        archived: filters.collection === "archived",
        kind: filters.kind || undefined,
        q: filters.q || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: Boolean(moduleId && userId),
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.data.some((practice) => practice.status === "generating"),
      )
        ? 3000
        : false,
  });
}
