import { useAuth } from "@clerk/react";
import type {
  CreatePdfSourceFieldsInput,
  CreateTextSourceBodyInput,
  CreateUrlSourceBodyInput,
  ListSourcesQueryInput,
} from "@ngertiin/contracts/api";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  createPdfSource,
  createTextSource,
  createUrlSource,
  getSource,
  listSources,
  retrySource,
} from "../../../lib/api";
import { useRefreshUsage } from "../../usage/use-usage";

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
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.data.some((source) => source.status === "pending" || source.status === "processing"),
      )
        ? 2_000
        : false,
  });
}

export function useSource(sourceId: string | undefined) {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: sourceQueryKey(userId, sourceId),
    queryFn: () => getSource(getToken, sourceId as string),
    enabled: Boolean(userId && sourceId),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" || query.state.data?.status === "processing"
        ? 2_000
        : false,
  });
}

export function useCreateTextSource() {
  const refreshUsage = useRefreshUsage();
  const { getToken } = useAuth();
  return useMutation({
    onSettled: refreshUsage,
    mutationFn: ({ input, key }: { input: CreateTextSourceBodyInput; key: string }) =>
      createTextSource(getToken, input, key),
  });
}

export function useCreateUrlSource() {
  const refreshUsage = useRefreshUsage();
  const { getToken } = useAuth();
  return useMutation({
    onSettled: refreshUsage,
    mutationFn: ({ input, key }: { input: CreateUrlSourceBodyInput; key: string }) =>
      createUrlSource(getToken, input, key),
  });
}

export function useCreatePdfSource() {
  const refreshUsage = useRefreshUsage();
  const { getToken } = useAuth();
  return useMutation({
    onSettled: refreshUsage,
    mutationFn: ({
      fields,
      file,
      key,
    }: {
      fields: CreatePdfSourceFieldsInput;
      file: File;
      key: string;
    }) => createPdfSource(getToken, fields, file, key),
  });
}

export function useRetrySource() {
  const refreshUsage = useRefreshUsage();
  const { getToken } = useAuth();
  return useMutation({
    onSettled: refreshUsage,
    mutationFn: ({ sourceId, key }: { sourceId: string; key: string }) =>
      retrySource(getToken, sourceId, key),
  });
}
