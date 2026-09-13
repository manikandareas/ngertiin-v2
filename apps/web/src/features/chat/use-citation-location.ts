import { useAuth } from "@clerk/react";
import { uuidSchema } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { chatApi } from "./api/chat-api";

export function useCitationLocation() {
  const { getToken, userId } = useAuth();
  const [params] = useSearchParams();
  const threadId = params.get("threadId") ?? "";
  const messageId = params.get("messageId") ?? "";
  const citationId = params.get("citationId") ?? "";
  const requested = params.has("citationId");
  const valid = [threadId, messageId, citationId].every((id) => uuidSchema.safeParse(id).success);
  const query = useQuery({
    queryKey: ["chat-citation", userId, threadId, messageId, citationId],
    queryFn: () => chatApi(getToken).citation(threadId, messageId, citationId),
    enabled: Boolean(userId && valid),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  return { ...query, requested, valid, threadId, params };
}
