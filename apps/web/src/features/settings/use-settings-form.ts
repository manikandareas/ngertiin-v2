import { useAuth } from "@clerk/react";
import type { PatchCurrentUserBody } from "@ngertiin/contracts/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { ApiProblemError, patchCurrentUser } from "../../lib/api";
import { currentUserQueryKey } from "../current-user/api/use-current-user";
import { leaderboardQueryKey } from "../leaderboard/use-leaderboard";

export function settingsError(error: unknown) {
  return error instanceof ApiProblemError
    ? error.problem.detail
    : "Perubahan belum berhasil. Coba lagi sebentar, ya.";
}
export function useSettingsForm(
  dirty: boolean,
  onDirty: (dirty: boolean) => void,
  successMessage: string,
) {
  const { getToken, userId } = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  return useMutation({
    mutationFn: (input: PatchCurrentUserBody) => patchCurrentUser(getToken, input),
    onError: (error) => toast.error(settingsError(error)),
    onSuccess: (user) => {
      client.setQueryData(currentUserQueryKey(userId), user);
      toast.success(successMessage);
      void client.invalidateQueries({ queryKey: leaderboardQueryKey(userId) });
    },
  });
}
