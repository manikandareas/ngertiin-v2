import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../../../lib/api";

export function currentUserQueryKey(userId: string | null | undefined) {
  return ["current-user", userId] as const;
}

export function useCurrentUser() {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: currentUserQueryKey(userId),
    enabled: Boolean(userId),
    refetchInterval: 15 * 60_000,
    queryFn: () => getCurrentUser(getToken),
  });
}
