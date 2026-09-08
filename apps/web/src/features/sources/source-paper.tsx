import type { Source } from "@ngertiin/contracts/api";
import { ChevronRight, FileText, Globe2, NotebookPen, Sparkles } from "lucide-react";
import { sourceItemMetadata, sourceOrigin, sourceTitle, statusLabels } from "./source-presentation";

const paperStyles = {
  pdf: {
    icon: FileText,
    label: "PDF",
    surface:
      "rounded-[3px_12px_12px_3px] border border-source-book-edge border-l-12 border-l-source-book-spine bg-source-book p-6 pl-9 text-source-book-ink shadow-source-book",
    title: "mt-8 text-[26px]",
  },
  url: {
    icon: Globe2,
    label: "Web",
    surface:
      "border-8 border-white bg-source-postcard p-4 text-source-postcard-ink outline outline-source-postcard-edge shadow-sm",
    title: "mt-2 text-xl",
  },
  text: {
    icon: NotebookPen,
    label: "Teks",
    surface:
      "source-note-paper border-t border-source-note-rule bg-source-note py-7 pr-5 pl-9 text-source-note-ink",
    title: "mt-6 text-2xl",
  },
};

type SourcePaperProps = {
  source: Source;
  onPreview: (source: Source, trigger: HTMLElement) => void;
};

/** Visual paper only; collection actions and retry belong to SourceItem. */
export function SourcePaper({ source, onPreview }: SourcePaperProps) {
  const title = sourceTitle(source);
  const origin = sourceOrigin(source);
  const style = paperStyles[source.type];
  const Icon = style.icon;

  return (
    <div
      className={`group relative isolate flex h-100 flex-col has-focus-visible:outline-2 has-focus-visible:-outline-offset-5 has-focus-visible:outline-current ${style.surface}`}
    >
      {source.type === "pdf" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-6 left-2 text-[7px] tracking-[0.3em] opacity-65 [writing-mode:vertical-rl]"
        >
          BAHAN BELAJAR
        </span>
      ) : null}
      {source.type === "url" ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-5 left-1/2 h-7 w-16 -translate-x-1/2 bg-source-tape"
          />
          <div
            aria-hidden="true"
            className="bg-source-postcard-dots -mx-2 -mt-2 mb-3 flex h-16 shrink-0 items-center justify-around bg-source-postcard-art text-source-postcard-art-ink"
          >
            <Sparkles size={20} strokeWidth={1} />
            <Globe2 size={52} strokeWidth={1} />
            <Sparkles size={20} strokeWidth={1} />
          </div>
        </>
      ) : null}
      {source.type === "text" ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-6 border-l border-source-note-margin"
          />
          <span
            aria-hidden="true"
            className="bg-source-note-holes pointer-events-none absolute top-4 bottom-5 left-1.5 w-2"
          />
        </>
      ) : null}
      <span className="flex w-fit shrink-0 items-center gap-1.5 text-[10px] font-black tracking-widest uppercase">
        <Icon size={15} aria-hidden="true" />
        {style.label}
      </span>
      <h2 className={`mb-2.5 shrink-0 font-extrabold leading-[1.3] tracking-tight ${style.title}`}>
        <button
          type="button"
          className="line-clamp-3 cursor-pointer text-left wrap-anywhere decoration-1 underline-offset-4 after:absolute after:inset-0 after:z-10 after:content-[''] group-hover:underline focus-visible:outline-none"
          title={title}
          onClick={(event) => onPreview(source, event.currentTarget)}
        >
          {title}
        </button>
      </h2>
      {source.type === "pdf" ? (
        <span
          aria-hidden="true"
          className="mt-2.5 mb-4 grid size-12 shrink-0 place-items-center rounded-full border border-source-book-stamp text-[10px] outline outline-offset-[-5px] outline-source-book-stamp"
        >
          PDF
        </span>
      ) : null}
      {source.type === "text" ? (
        <p className="line-clamp-3 text-caption leading-7 italic">
          {source.status === "ready"
            ? "Buka catatan untuk membaca kembali isi materimu."
            : statusLabels[source.status]}
        </p>
      ) : (
        <p className="my-1 line-clamp-3 text-[11px] leading-relaxed wrap-anywhere" title={origin}>
          {origin}
        </p>
      )}
      <div
        className={`mt-auto flex shrink-0 items-center justify-between gap-2 pt-3.5 text-[10px] ${source.type === "url" ? "border-t border-dashed border-source-postcard-rule" : ""}`}
      >
        <span>{sourceItemMetadata(source)}</span>
        <ChevronRight
          className="shrink-0 rounded-full border border-current p-1"
          size={30}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
