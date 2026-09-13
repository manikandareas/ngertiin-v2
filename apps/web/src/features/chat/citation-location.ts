import type { ChatCitation, ChatCitationSnapshot } from "@ngertiin/contracts/api";

export function citationLink(threadId: string, messageId: string, citation: ChatCitation) {
  const path =
    citation.reference.kind === "source"
      ? `/sources/${citation.reference.sourceId}`
      : "/chat/citation";
  return `${path}?${new URLSearchParams({ threadId, messageId, citationId: citation.id })}`;
}

export function citationDestination(snapshot: ChatCitationSnapshot): string | null {
  const reference = snapshot.citation.reference;
  if (reference.kind === "source") return `/sources/${reference.sourceId}`;
  return snapshot.moduleId ? `/modules/${snapshot.moduleId}/nodes/${reference.nodeId}` : null;
}
