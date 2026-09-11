import type { ChatCitation } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { DialogFrame } from "../../../components/ui/dialog-frame";
import type { chatApi } from "../api/chat-api";

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
}: {
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
  // Do not expose internal IDs or incomplete markers during streaming.
  const fragments = text.replace(/\[\[cite:[^\]]*\]?$/, "").split(/(\[\[cite:[^\]]*\]\])/g);
  let offset = 0;
  return (
    <>
      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {fragments.map((fragment) => {
          offset += fragment.length;
          if (!fragment.startsWith("[[cite:")) return fragment;
          const citation = citations.find((item) => `[[cite:${item.id}]]` === fragment);
          return citation ? (
            <button
              key={`${offset}:${citation.id}`}
              type="button"
              onClick={() => open(citation)}
              className="mx-1 rounded bg-accent px-1.5 align-super text-[10px] font-bold text-link hover:bg-primary/15"
              aria-label={`Buka rujukan ${citations.indexOf(citation) + 1}`}
            >
              {citations.indexOf(citation) + 1}
            </button>
          ) : null;
        })}
      </p>
      {citations.length ? (
        <div className="mt-4 space-y-2">
          {citations.map((citation, index) => (
            <button
              type="button"
              key={citation.id}
              onClick={() => open(citation)}
              className="flex w-full gap-3 rounded-xl border p-3 text-left hover:bg-accent/50"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-xs font-bold text-link">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{citation.title}</span>
                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                  “{citation.excerpt}”
                </span>
                <span className="mt-2 block text-[10px] text-muted-foreground">
                  {citation.origin === "original_source" ? "Sumber asli" : "Materi pelajaran"}
                  {citationLocation(citation)}
                </span>
              </span>
              <ArrowUpRight
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
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
            <ChevronLeft />
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
            <ChevronRight />
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
              <Quote />
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
