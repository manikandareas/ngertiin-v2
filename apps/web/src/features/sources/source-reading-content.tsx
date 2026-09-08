import type { Source } from "@ngertiin/contracts/api";
import { Streamdown } from "streamdown";
import { Button } from "../../components/ui/button";
import { useSourcePreview } from "./api/use-sources";
import { SourceTextEditor } from "./source-text-editor";

export function SourceReadingContent({
  source,
  onDirtyChange,
}: {
  source: Source;
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
