import type { ChatCitation, ChatCitationSnapshot } from "@ngertiin/contracts/api";

export function citationLink(threadId: string, messageId: string, citation: ChatCitation) {
  if (citation.origin === "web") return citation.url;
  const path =
    citation.reference.kind === "source"
      ? `/sources/${citation.reference.sourceId}`
      : "/chat/citation";
  return `${path}?${new URLSearchParams({ threadId, messageId, citationId: citation.id })}`;
}

export function citationLabel(citation: ChatCitation) {
  return citation.origin === "web"
    ? new URL(citation.url).hostname.replace(/^www\./, "")
    : (citation.sectionTitle ?? citation.title);
}

export function citationDestination(snapshot: ChatCitationSnapshot): string | null {
  const reference = snapshot.citation.reference;
  if (reference.kind === "source") return `/sources/${reference.sourceId}`;
  return snapshot.moduleId ? `/modules/${snapshot.moduleId}/nodes/${reference.nodeId}` : null;
}
