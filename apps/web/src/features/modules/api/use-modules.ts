import { useAuth } from "@clerk/react";
import type {
  CreateModuleBodyInput,
  GenerationStatus,
  SubmitAttemptBody,
} from "@ngertiin/contracts/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  completeNode,
  createModule,
  getGeneration,
  getAttempt,
  getJourney,
  getModule,
  getNode,
  retryGeneration,
  streamGenerationEvents,
  startNode,
  submitAttempt,
} from "../../../lib/api";
import { currentUserQueryKey } from "../../current-user/api/use-current-user";

const reconnectDelays = [1_000, 2_000, 4_000, 8_000] as const;

export function moduleQueryKey(userId: string | null | undefined, moduleId: string | undefined) {
  return ["module", userId, moduleId] as const;
}

export function generationQueryKey(
  userId: string | null | undefined,
  moduleId: string | undefined,
) {
  return ["module-generation", userId, moduleId] as const;
}

export function journeyQueryKey(userId: string | null | undefined, moduleId: string | undefined) {
  return ["module-journey", userId, moduleId] as const;
}

export function nodeQueryKey(
  userId: string | null | undefined,
  moduleId: string | undefined,
  nodeId: string | undefined,
) {
  return ["module-node", userId, moduleId, nodeId] as const;
}

export function attemptQueryKey(userId: string | null | undefined, attemptId: string | undefined) {
  return ["attempt", userId, attemptId] as const;
}

export function useCreateModule() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: ({ input, key }: { input: CreateModuleBodyInput; key: string }) =>
      createModule(getToken, input, key),
  });
}

export function useModule(moduleId: string | undefined) {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: moduleQueryKey(userId, moduleId),
    queryFn: () => getModule(getToken, moduleId as string),
    enabled: Boolean(userId && moduleId),
  });
}

export function useJourney(moduleId: string | undefined) {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: journeyQueryKey(userId, moduleId),
    queryFn: () => getJourney(getToken, moduleId as string),
    enabled: Boolean(userId && moduleId),
  });
}

export function useNode(moduleId: string | undefined, nodeId: string | undefined) {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: nodeQueryKey(userId, moduleId, nodeId),
    queryFn: () => getNode(getToken, moduleId as string, nodeId as string),
    enabled: Boolean(userId && moduleId && nodeId),
  });
}

function useProgressCacheSync(moduleId: string, nodeId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: journeyQueryKey(userId, moduleId) }),
      queryClient.invalidateQueries({ queryKey: moduleQueryKey(userId, moduleId) }),
      queryClient.invalidateQueries({ queryKey: nodeQueryKey(userId, moduleId, nodeId) }),
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey(userId) }),
    ]);
  };
}

export function useStartNode(moduleId: string, nodeId: string) {
  const { getToken } = useAuth();
  const sync = useProgressCacheSync(moduleId, nodeId);
  return useMutation({
    mutationFn: () => startNode(getToken, moduleId, nodeId),
    onSuccess: sync,
  });
}

export function useCompleteNode(moduleId: string, nodeId: string) {
  const { getToken } = useAuth();
  const sync = useProgressCacheSync(moduleId, nodeId);
  return useMutation({
    mutationFn: () => completeNode(getToken, moduleId, nodeId),
    onSuccess: sync,
  });
}

export function useAttempt(attemptId: string | undefined) {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: attemptQueryKey(userId, attemptId),
    queryFn: () => getAttempt(getToken, attemptId as string),
    enabled: Boolean(userId && attemptId),
    refetchInterval: (query) =>
      query.state.data?.attempt.evaluationStatus === "evaluating" ? 1_000 : false,
  });
}

export function useSubmitAttempt(moduleId: string, nodeId: string) {
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const sync = useProgressCacheSync(moduleId, nodeId);
  return useMutation({
    mutationFn: (input: SubmitAttemptBody) => submitAttempt(getToken, moduleId, nodeId, input),
    onSuccess: async (result) => {
      queryClient.setQueryData(attemptQueryKey(userId, result.attempt.id), result);
      await sync();
    },
  });
}

export function useGeneration(moduleId: string | undefined, fallbackPolling: boolean) {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: generationQueryKey(userId, moduleId),
    queryFn: () => getGeneration(getToken, moduleId as string),
    enabled: Boolean(userId && moduleId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return fallbackPolling && state !== "completed" && state !== "failed" ? 5_000 : false;
    },
  });
}

export function useGenerationStream(moduleId: string | undefined, restartToken = 0): boolean {
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const [fallbackPolling, setFallbackPolling] = useState(false);

  useEffect(() => {
    if (!moduleId || !userId) return;
    let stopped = false;
    let terminal = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    setFallbackPolling(false);

    const connect = async (reconnectIndex: number): Promise<void> => {
      controller = new AbortController();
      try {
        await streamGenerationEvents(getToken, moduleId, controller.signal, (event) => {
          terminal = event.data.state === "completed" || event.data.state === "failed";
          queryClient.setQueryData<GenerationStatus>(
            generationQueryKey(userId, moduleId),
            event.data,
          );
          if (terminal) {
            void queryClient.invalidateQueries({ queryKey: moduleQueryKey(userId, moduleId) });
          }
        });
      } catch {
        if (controller.signal.aborted || stopped) return;
      }
      if (stopped || terminal) return;
      const delay = reconnectDelays[reconnectIndex];
      if (delay === undefined) {
        setFallbackPolling(true);
        return;
      }
      retryTimer = setTimeout(() => void connect(reconnectIndex + 1), delay);
    };

    void connect(0);
    return () => {
      stopped = true;
      controller?.abort(`Generation stream revision ${restartToken} stopped.`);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [getToken, moduleId, queryClient, restartToken, userId]);

  return fallbackPolling;
}

export function useRetryGeneration(moduleId: string) {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: (key: string) => retryGeneration(getToken, moduleId, key),
  });
}
