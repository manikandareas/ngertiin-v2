import { useAuth } from "@clerk/react";
import type { CurrentUser } from "@ngertiin/contracts/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiProblemError, patchCurrentUser } from "../../../lib/api";
import { currentUserQueryKey } from "./use-current-user";

export function useSelectCurrentModule() {
  const { getToken, userId } = useAuth();
  const client = useQueryClient();
  const key = currentUserQueryKey(userId);
  const selectionKey = ["current-module-selection", userId] as const;

  return useMutation({
    scope: { id: `current-module:${userId}` },
    mutationFn: (moduleId: string) => patchCurrentUser(getToken, { currentModuleId: moduleId }),
    onMutate: (moduleId) => {
      const sequence = (client.getQueryData<number>(selectionKey) ?? 0) + 1;
      client.setQueryData(selectionKey, sequence);
      if (client.getQueryData<CurrentUser>(key)) {
        void client.cancelQueries({ queryKey: key });
        client.setQueryData<CurrentUser>(key, (user) =>
          user ? { ...user, currentModuleId: moduleId } : user,
        );
      }
      return { sequence };
    },
    onSuccess: (saved, _moduleId, context) => {
      if (client.getQueryData<number>(selectionKey) !== context.sequence) return;
      client.setQueryData<CurrentUser>(key, (user) =>
        user ? { ...user, currentModuleId: saved.currentModuleId } : saved,
      );
      void client.invalidateQueries({ queryKey: key });
    },
    onError: (error, _moduleId, context) => {
      if (client.getQueryData<number>(selectionKey) !== context?.sequence) return;
      client.setQueryData<CurrentUser>(key, (user) =>
        user ? { ...user, currentModuleId: null } : user,
      );
      toast.error(
        error instanceof ApiProblemError
          ? error.problem.detail
          : "Pilihan modul belum tersimpan. Coba pilih lagi.",
      );
      void client.invalidateQueries({ queryKey: key });
    },
  });
}
