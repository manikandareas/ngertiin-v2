import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsage } from "../../lib/api";
export function usageQueryKey(userId: string | null | undefined) {
  return ["usage", userId] as const;
}

export function useUsage() {
  const { userId, getToken } = useAuth();
  const query = useQuery({
    queryKey: usageQueryKey(userId),
    queryFn: () => getUsage(getToken),
    enabled: Boolean(userId),
    refetchOnWindowFocus: "always",
    refetchInterval: (query) => (query.state.data?.activeModuleId ? 2000 : 60_000),
  });
  return query;
}
export function useRefreshUsage() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return () => {
    if (userId && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`usage:${userId}`);
      channel.postMessage("changed");
      channel.close();
    }
    return client.invalidateQueries({ queryKey: usageQueryKey(userId) });
  };
}
