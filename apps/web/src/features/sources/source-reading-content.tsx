import type { ChatCitationSnapshot, Source } from "@ngertiin/contracts/api";
import { Streamdown } from "streamdown";
import { Button } from "../../components/ui/button";
import { CitationContent } from "../chat/components/citation-content";
import { useSourcePreview } from "./api/use-sources";
import { SourceTextEditor } from "./source-text-editor";

export function SourceReadingContent({
  source,
  onDirtyChange,
  citation,
}: {
  source: Source;
  citation?: ChatCitationSnapshot;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const preview = useSourcePreview(source.id, source.status);
  if (preview.isPending) return <p role="status">Memuat isi materi…</p>;
  if (!preview.data)
    return (
      <div role="alert">
        <p>Isi materi belum dapat dimuat.</p>
        <Button variant="outline" onClick={() => void preview.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  if (citation && citation.citation.reference.kind === "source") {
    const targetId = citation.citation.reference.sourceContentId;
    return (
      <>
        <CitationContent
          snapshot={citation}
          markdown={source.type !== "text"}
          selector={`[data-source-content="${targetId}"]`}
        >
          <article className="lesson-markdown min-w-0 space-y-8 leading-8">
            {preview.data.sections.length ? (
              preview.data.sections.map((section) => (
                <section key={section.id ?? section.position} data-source-content={section.id}>
                  {section.heading ? (
                    <h2 className="mb-4 text-lg font-semibold">{section.heading}</h2>
                  ) : null}
                  {source.type === "text" ? (
                    <p className="whitespace-pre-wrap">{section.content}</p>
                  ) : (
                    <Streamdown mode="static" skipHtml>
                      {section.content}
                    </Streamdown>
                  )}
                </section>
              ))
            ) : (
              <p className="whitespace-pre-wrap">{preview.data.text}</p>
            )}
          </article>
        </CitationContent>
        {source.type === "text" ? (
          <details className="mt-8 rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">Edit catatan</summary>
            <div className="mt-4">
              <SourceTextEditor
                id={source.id}
                text={preview.data.text ?? ""}
                onDirtyChange={onDirtyChange}
              />
            </div>
          </details>
        ) : null}
      </>
    );
  }
  if (source.type === "text")
    return (
      <SourceTextEditor
        id={source.id}
        text={preview.data.text ?? ""}
        onDirtyChange={onDirtyChange}
      />
    );
  const content = preview.data.sections.length
    ? preview.data.sections
        .map((section) => `${section.heading ? `## ${section.heading}\n\n` : ""}${section.content}`)
        .join("\n\n")
    : preview.data.text;
  if (!content)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {source.status === "failed"
          ? "Isi halaman belum tersedia karena pemrosesan gagal."
          : "Isi halaman akan tampil setelah pemrosesan selesai."}
      </p>
    );
  return (
    <article className="lesson-markdown min-w-0 leading-8">
      <Streamdown mode="static" skipHtml>
        {content}
      </Streamdown>
    </article>
  );
}
