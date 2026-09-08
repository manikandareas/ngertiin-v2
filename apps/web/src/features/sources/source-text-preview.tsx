import type { SourceStatus } from "@ngertiin/contracts/api";
import { Button } from "../../components/ui/button";
import { useSourcePreview } from "./api/use-sources";

type SourceTextPreviewProps = { id: string; status: SourceStatus };
export function SourceTextPreview({ id, status }: SourceTextPreviewProps) {
  const preview = useSourcePreview(id, status);
  if (preview.isPending) return <p role="status">Memuat isi materi…</p>;
  if (preview.isError)
    return (
      <div role="alert">
        Isi materi belum dapat dimuat.{" "}
        <Button variant="outline" onClick={() => void preview.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  if (preview.data.sections.length)
    return (
      <div className="space-y-5">
        {preview.data.sections.map((section) => (
          <section key={section.position} className="border-b pb-5">
            <h2 className="mb-2 text-sm font-semibold">
              {section.pageNumber
                ? `Halaman ${section.pageNumber}`
                : section.heading || `Bagian ${section.position}`}
            </h2>
            <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-7">{section.content}</p>
          </section>
        ))}
      </div>
    );
  if (preview.data.text)
    return (
      <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-7">{preview.data.text}</p>
    );
  return (
    <p className="text-sm text-muted-foreground">
      Hasil ekstraksi belum tersedia.{" "}
      {status === "failed"
        ? "Periksa status pemrosesan materi."
        : "Materi akan tampil setelah pemrosesan selesai."}
    </p>
  );
}
