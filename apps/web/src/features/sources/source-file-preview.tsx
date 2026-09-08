import { Button } from "../../components/ui/button";
import { useSourceFile } from "./api/use-sources";
export function SourceFilePreview({ id }: { id: string }) {
  const file = useSourceFile(id);
  return (
    <>
      {" "}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={file.isFetching}
          onClick={() => void file.refetch()}
        >
          Muat ulang dokumen
        </Button>
        {file.data ? (
          <a
            href={file.data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-link underline"
          >
            Buka di tab baru
          </a>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Tautan dokumen berlaku 5 menit. Muat ulang jika kedaluwarsa atau dokumen tidak tampil.
      </p>
      {file.isPending ? (
        <p role="status">Memuat dokumen…</p>
      ) : file.isError ? (
        <p role="alert">Dokumen belum dapat dibuka. Coba muat ulang.</p>
      ) : (
        <iframe
          key={file.data.url}
          src={file.data.url}
          title="Dokumen PDF asli"
          className="h-[60dvh] w-full rounded-lg border"
        />
      )}
    </>
  );
}
