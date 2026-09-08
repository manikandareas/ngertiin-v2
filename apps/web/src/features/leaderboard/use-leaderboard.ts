import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getLeaderboard } from "../../lib/api";

export const leaderboardQueryKey = (userId: string | null | undefined) =>
  ["leaderboard", userId] as const;

export function useLeaderboard() {
  const { getToken, userId } = useAuth();
  const query = useQuery({
    queryKey: leaderboardQueryKey(userId),
    queryFn: async () => ({ data: await getLeaderboard(getToken), receivedAt: performance.now() }),
    enabled: Boolean(userId),
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const { refetch, data } = query;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", refresh);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (data?.data.nextExpiresAt) {
      const remaining =
        Date.parse(data.data.nextExpiresAt) -
        Date.parse(data.data.serverTime) -
        (performance.now() - data.receivedAt);
      timer = setTimeout(refresh, Math.max(0, remaining) + 50);
    }
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearTimeout(timer);
    };
  }, [data, refetch]);
  return { ...query, data: data?.data };
}
