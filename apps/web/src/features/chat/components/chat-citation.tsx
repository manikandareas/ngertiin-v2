import { Book02Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatCitation, ChatImage } from "@ngertiin/contracts/api";
import { ArrowUpRight, Check, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { citationLabel, citationLink } from "../citation-location";
import { citationText } from "../citation-text";
import { useStreamedText } from "../use-streamed-text";
import { chatFileChipClassName } from "./chat-file-badge";
import { ChatMarkdown } from "./chat-markdown";
import { ChatSourceFavicon } from "./chat-source-favicon";

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
      const answer = citationText(text, citations).replace(
        /\[\[cite:([^\]]*)\]\]/g,
        (_, id: string) => {
          const index = citations.findIndex((citation) => citation.id === id);
          return index < 0 ? "" : `[${index + 1}]`;
        },
      );
      const webReferences = citations.flatMap((citation, index) =>
        citation.origin === "web" ? [`[${index + 1}] ${citation.title}: ${citation.url}`] : [],
      );
      await navigator.clipboard.writeText(
        webReferences.length ? `${answer}\n\n${webReferences.join("\n")}` : answer,
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
          className="mt-2 flex min-w-0 flex-wrap gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          aria-label="Rujukan jawaban"
        >
          {citations.map((citation, index) => (
            <a
              key={citation.id}
              href={href(citation)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                chatFileChipClassName,
                "w-fit max-w-[min(100%,16rem)] text-left transition-colors hover:bg-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none dark:hover:bg-zinc-700",
              )}
              title={
                citation.origin === "web"
                  ? `${citation.title} · ${citationLabel(citation)}`
                  : `${citation.origin === "original_source" ? "Sumber" : "Modul"}: ${citation.title}${citation.sectionTitle && citation.sectionTitle !== citation.title ? ` · ${citation.sectionTitle}` : ""}${citation.pageNumber ? ` · Hal. ${citation.pageNumber}` : ""}`
              }
              aria-label={`Buka rujukan ${index + 1}: ${citation.title} di tab baru`}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white",
                  {
                    web: "bg-white",
                    original_source: "bg-orange-600",
                    generated_material: "bg-teal-600",
                  }[citation.origin],
                )}
              >
                {citation.origin === "web" ? (
                  <ChatSourceFavicon url={citation.url} className="size-4" />
                ) : (
                  <HugeiconsIcon
                    icon={citation.origin === "original_source" ? File01Icon : Book02Icon}
                    size={14}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="min-w-0 truncate">
                {citation.origin === "web" ? citation.title : citationLabel(citation)}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <ArrowUpRight
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </a>
          ))}
        </section>
      ) : null}
    </>
  );
}
