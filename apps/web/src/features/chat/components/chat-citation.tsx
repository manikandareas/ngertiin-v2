import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Book02Icon,
  File01Icon,
  QuoteUpIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatCitation } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { DialogFrame } from "../../../components/ui/dialog-frame";
import type { chatApi } from "../api/chat-api";

import { ChatMarkdown } from "./chat-markdown";

function citationLocation(citation: ChatCitation): string {
  if (citation.pageNumber) return ` · Halaman ${citation.pageNumber}`;
  if (citation.sectionTitle) return ` · ${citation.sectionTitle}`;
  return "";
}

export function ChatCitedAnswer({
  text,
  citations,
  messageId,
  threadId,
  api,
  isAnimating = false,
}: {
  isAnimating?: boolean;
  text: string;
  citations: ChatCitation[];
  messageId: string;
  threadId: string;
  api: ReturnType<typeof chatApi>;
}) {
  const [selected, setSelected] = useState<ChatCitation | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  function open(citation: ChatCitation) {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(citation);
  }
  return (
    <>
      <ChatMarkdown text={text} citations={citations} onCitation={open} isAnimating={isAnimating} />
      {citations.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {citations.map((citation, index) => (
            <button
              type="button"
              key={citation.id}
              onClick={() => open(citation)}
              className="flex h-[42px] min-w-0 max-w-full items-center gap-2 rounded-xl border bg-muted px-3 text-left hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              title={`${citation.title} · ${citation.origin === "original_source" ? "Sumber asli" : "Materi pelajaran"}${citationLocation(citation)}`}
              aria-label={`Buka rujukan ${index + 1}: ${citation.title}`}
            >
              <HugeiconsIcon
                icon={citation.origin === "original_source" ? File01Icon : Book02Icon}
                size={16}
                strokeWidth={1.5}
                className="shrink-0 text-adaptive-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 max-w-[155px] truncate text-[11px] font-semibold">
                {citation.title}
              </span>
              <span className="shrink-0 border-l pl-2 text-[10px] font-bold text-muted-foreground">
                {index + 1}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <ChatCitationReader
          key={selected.id}
          citation={selected}
          citations={citations}
          messageId={messageId}
          threadId={threadId}
          api={api}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
          returnFocus={() => trigger.current?.focus()}
        />
      ) : null}
    </>
  );
}

function ChatCitationReader({
  citation,
  citations,
  threadId,
  messageId,
  api,
  onSelect,
  onClose,
  returnFocus,
}: {
  citation: ChatCitation;
  citations: ChatCitation[];
  threadId: string;
  messageId: string;
  api: ReturnType<typeof chatApi>;
  onSelect: (citation: ChatCitation) => void;
  onClose: () => void;
  returnFocus: () => void;
}) {
  const excerpt = useRef<HTMLElement>(null);
  const reader = useQuery({
    queryKey: ["chat-citation", threadId, messageId, citation.id],
    queryFn: () => api.citation(threadId, messageId, citation.id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const data = reader.data;
  const points = data ? [...data.text] : [];
  const start = data ? data.citation.reference.startCodePoint - data.startCodePoint : 0;
  const end = data ? data.citation.reference.endCodePoint - data.startCodePoint : 0;
  const index = citations.findIndex((item) => item.id === citation.id);
  return (
    <DialogFrame
      open
      title={citation.title}
      description="Materi saat jawaban dibuat · bagian yang digunakan disorot."
      onClose={onClose}
      returnFocus={returnFocus}
      className="max-w-2xl"
    >
      <div className="mb-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          Rujukan {index + 1} dari {citations.length}
          {citation.pageNumber ? ` · Halaman ${citation.pageNumber}` : ""}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Rujukan sebelumnya"
            disabled={index === 0}
            onClick={() => {
              const next = citations[index - 1];
              if (next) onSelect(next);
            }}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.5} aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Rujukan berikutnya"
            disabled={index === citations.length - 1}
            onClick={() => {
              const next = citations[index + 1];
              if (next) onSelect(next);
            }}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {reader.isPending ? (
        <p role="status" className="py-10 text-center text-sm text-muted-foreground">
          Memuat kutipan…
        </p>
      ) : reader.isError ? (
        <div role="alert" className="py-8 text-center">
          <p className="text-sm">Kutipan belum dapat dimuat.</p>
          <Button variant="link" onClick={() => void reader.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : data ? (
        <>
          <div className="max-h-[50dvh] overflow-y-auto overscroll-contain rounded-xl border bg-muted/20 p-5 sm:p-8">
            <p className="mb-5 text-xs text-muted-foreground">
              {citation.sectionTitle ?? citation.title}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-8 [overflow-wrap:anywhere]">
              {points.slice(0, start).join("")}
              <mark
                ref={excerpt}
                className="rounded bg-accent text-accent-foreground ring-2 ring-accent"
              >
                {points.slice(start, end).join("")}
              </mark>
              {points.slice(end).join("")}
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                excerpt.current?.scrollIntoView({ block: "center", behavior: "smooth" })
              }
            >
              <HugeiconsIcon icon={QuoteUpIcon} strokeWidth={1.5} aria-hidden="true" />
              Ke kutipan
            </Button>
            <Button size="sm" onClick={onClose}>
              Kembali ke jawaban
            </Button>
          </div>
        </>
      ) : null}
    </DialogFrame>
  );
}
