import { Book02Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatCitation } from "@ngertiin/contracts/api";
import { ArrowUpRight } from "lucide-react";
import { citationLink } from "../citation-location";
import { ChatMarkdown } from "./chat-markdown";
import { CitationPreview } from "./citation-preview";

const cardColors = [
  "bg-[#fff0b3] text-[#594113]",
  "bg-[#dceecb] text-[#30492c]",
  "bg-[#fbdedb] text-[#653631]",
  "bg-[#dce7ff] text-[#35476d]",
];

export function ChatCitedAnswer({
  text,
  citations,
  messageId,
  threadId,
  isAnimating = false,
}: {
  text: string;
  citations: ChatCitation[];
  messageId: string;
  threadId: string;
  isAnimating?: boolean;
}) {
  const href = (citation: ChatCitation) => citationLink(threadId, messageId, citation);
  return (
    <>
      <ChatMarkdown
        text={text}
        citations={citations}
        citationHref={href}
        isAnimating={isAnimating}
      />
      {citations.length > 0 ? (
        <section
          className="mt-3 flex min-w-0 flex-wrap items-start gap-2"
          aria-label="Rujukan jawaban"
        >
          {citations.map((citation, index) => (
            <a
              key={citation.id}
              href={href(citation)}
              target="_blank"
              rel="noopener noreferrer"
              className={`group block w-64 max-w-full min-w-0 rounded-xl p-3 text-left transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${cardColors[index % cardColors.length]}`}
              aria-label={`Buka rujukan ${index + 1}: ${citation.title} di tab baru`}
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1 line-clamp-2 break-words text-xs font-semibold leading-5 [overflow-wrap:anywhere]">
                  {citation.sectionTitle ?? citation.title}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums opacity-75">{index + 1}</span>
                <ArrowUpRight className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
              </div>
              <CitationPreview text={citation.excerpt} />
              <div className="mt-2 flex min-w-0 items-center gap-1.5 border-t border-current/15 pt-2 text-[10px]">
                <HugeiconsIcon
                  icon={citation.origin === "original_source" ? File01Icon : Book02Icon}
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0"
                  aria-hidden="true"
                />
                <span className="shrink-0 opacity-75">
                  {citation.origin === "original_source" ? "Sumber" : "Modul"}
                </span>
                <span className="min-w-0 truncate font-medium" title={citation.title}>
                  {citation.title}
                </span>
                {citation.pageNumber ? (
                  <span className="ml-auto shrink-0 opacity-75">Hal. {citation.pageNumber}</span>
                ) : null}
              </div>
            </a>
          ))}
        </section>
      ) : null}
    </>
  );
}
