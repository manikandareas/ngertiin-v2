import { useAuth } from "@clerk/react";
import type { CreateModuleBodyInput, GenerationStatus } from "@ngertiin/contracts/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  createModule,
  getGeneration,
  getModule,
  retryGeneration,
  streamGenerationEvents,
} from "../../../lib/api";

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
