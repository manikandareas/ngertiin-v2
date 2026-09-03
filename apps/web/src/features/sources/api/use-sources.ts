import { useAuth } from "@clerk/react";
import type { CreateTextSourceBodyInput, ListSourcesQueryInput } from "@ngertiin/contracts/api";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { createTextSource, getSource, listSources } from "../../../lib/api";

type SourceFilters = Pick<ListSourcesQueryInput, "type" | "status" | "limit">;

export function sourcesQueryKey(userId: string | null | undefined, filters: SourceFilters = {}) {
  return ["sources", userId, filters] as const;
}

export function sourcesQueryRootKey(userId: string | null | undefined) {
  return ["sources", userId] as const;
}

export function sourceQueryKey(userId: string | null | undefined, sourceId: string | undefined) {
  return ["source", userId, sourceId] as const;
}

export function useSources(filters: SourceFilters = {}) {
  const { getToken, userId } = useAuth();
  return useInfiniteQuery({
    queryKey: sourcesQueryKey(userId, filters),
    queryFn: ({ pageParam }) => listSources(getToken, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
    enabled: Boolean(userId),
  });
}

export function useSource(sourceId: string | undefined) {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: sourceQueryKey(userId, sourceId),
    queryFn: () => getSource(getToken, sourceId as string),
    enabled: Boolean(userId && sourceId),
  });
}

export function useCreateTextSource() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: ({ input, key }: { input: CreateTextSourceBodyInput; key: string }) =>
      createTextSource(getToken, input, key),
  });
}
