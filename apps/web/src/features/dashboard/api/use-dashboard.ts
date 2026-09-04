import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "../../../lib/api";

export function dashboardQueryKey(userId: string | null | undefined) {
  return ["dashboard", userId] as const;
}

export function useDashboard() {
  const { getToken, userId } = useAuth();
  return useQuery({
    queryKey: dashboardQueryKey(userId),
    queryFn: () => getDashboard(getToken),
    enabled: Boolean(userId),
  });
}
