import { Book02Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatCitation, ChatImage } from "@ngertiin/contracts/api";
import { ArrowUpRight, Check, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { citationLink } from "../citation-location";
import { useStreamedText } from "../use-streamed-text";
import { ChatMarkdown } from "./chat-markdown";

export function ChatCitedAnswer({
  text,
  citations,
  images,
  loadImage,
  messageId,
  threadId,
  isAnimating = false,
}: {
  text: string;
  citations: ChatCitation[];
  images: ChatImage[];
  loadImage: (id: string) => Promise<string>;
  messageId: string;
  threadId: string;
  isAnimating?: boolean;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const presentation = useStreamedText(text, isAnimating);
  const href = (citation: ChatCitation) => citationLink(threadId, messageId, citation);
  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(
        text.replace(/\[\[cite:([^\]]*)\]\]/g, (_, id: string) => {
          const index = citations.findIndex((citation) => citation.id === id);
          return index < 0 ? "" : `[${index + 1}]`;
        }),
      );
      setCopied(true);
    } catch {
      toast.error("Jawaban belum bisa disalin. Coba lagi.");
    }
  }
  return (
    <>
      <ChatMarkdown
        text={presentation.text}
        citations={citations}
        images={images}
        loadImage={loadImage}
        citationHref={href}
        isAnimating={presentation.revealing}
        animateWords={!presentation.reducedMotion && presentation.revealing}
      />
      {text ? (
        <div
          aria-hidden={presentation.revealing}
          inert={presentation.revealing}
          className={`mt-2 flex min-h-8 items-center gap-1 transition-opacity duration-200 motion-reduce:transition-none ${presentation.revealing ? "invisible opacity-0" : "visible opacity-100"}`}
        >
          <button
            type="button"
            aria-label={copied ? "Jawaban disalin" : "Salin jawaban"}
            title={copied ? "Disalin" : "Salin jawaban"}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
            onClick={copyAnswer}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
          {citations.length > 0 ? (
            <button
              type="button"
              aria-expanded={sourcesOpen}
              aria-controls={`sources-${messageId}`}
              onClick={() => setSourcesOpen((open) => !open)}
              className="flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
            >
              <HugeiconsIcon icon={Book02Icon} size={14} aria-hidden="true" />
              {citations.length} sumber
              <ChevronDown
                className={`size-3 transition-transform motion-reduce:transition-none ${sourcesOpen ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}
        </div>
      ) : null}
      {citations.length > 0 && !presentation.revealing && sourcesOpen ? (
        <section
          id={`sources-${messageId}`}
          className="mt-1.5 flex min-w-0 flex-col gap-1 rounded-xl bg-muted p-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          aria-label="Rujukan jawaban"
        >
          {citations.map((citation, index) => (
            <a
              key={citation.id}
              href={href(citation)}
              target="_blank"
              rel="noopener noreferrer"
              className="group block w-full min-w-0 rounded-lg p-2.5 text-left text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`Buka rujukan ${index + 1}: ${citation.title} di tab baru`}
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1 line-clamp-2 break-words text-xs font-semibold leading-5 [overflow-wrap:anywhere]">
                  {citation.sectionTitle ?? citation.title}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums opacity-75">{index + 1}</span>
                <ArrowUpRight className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
              </div>
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
