import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { dashboardQueryKey } from "../dashboard/api/use-dashboard";
import { modulesQueryRootKey } from "../modules/api/use-modules";
import { usageQueryKey, useUsage } from "./use-usage";

// Mount once in the connected shell, independent of sidebar visibility.
export function useUsageSync() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const query = useUsage();
  useEffect(() => {
    if (!userId || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`usage:${userId}`);
    channel.onmessage = () => void client.invalidateQueries({ queryKey: usageQueryKey(userId) });
    return () => channel.close();
  }, [client, userId]);
  const resetAt = query.data?.resetAt;
  useEffect(() => {
    if (!resetAt) return;
    const timer = setTimeout(
      () => void client.invalidateQueries({ queryKey: usageQueryKey(userId) }),
      Math.max(1000, Date.parse(resetAt) - Date.now() + 100),
    );
    return () => clearTimeout(timer);
  }, [client, resetAt, userId]);

  const activeModuleId = query.data?.activeModuleId;
  useEffect(() => {
    if (!userId || activeModuleId === undefined) return;
    // Recommendations depend on the account-wide slot, including changes in another tab.
    void Promise.all([
      client.invalidateQueries({ queryKey: modulesQueryRootKey(userId) }),
      client.invalidateQueries({ queryKey: dashboardQueryKey(userId) }),
    ]);
  }, [activeModuleId, client, userId]);
}
