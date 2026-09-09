import { useAuth } from "@clerk/react";
import type { PatchCurrentUserBody } from "@ngertiin/contracts/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ApiProblemError, patchCurrentUser } from "../../lib/api";
import { currentUserQueryKey } from "../current-user/api/use-current-user";
import { leaderboardQueryKey } from "../leaderboard/use-leaderboard";

export function settingsError(error: unknown) {
  return error instanceof ApiProblemError
    ? error.problem.detail
    : "Perubahan belum berhasil. Coba lagi sebentar, ya.";
}
export function useSettingsForm(dirty: boolean, onDirty: (dirty: boolean) => void) {
  const { getToken, userId } = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  return useMutation({
    mutationFn: (input: PatchCurrentUserBody) => patchCurrentUser(getToken, input),
    onSuccess: (user) => {
      client.setQueryData(currentUserQueryKey(userId), user);
      void client.invalidateQueries({ queryKey: leaderboardQueryKey(userId) });
    },
  });
}
