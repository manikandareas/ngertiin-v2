import type { Source } from "@ngertiin/contracts/api";

export const statusLabels = {
  ready: "Siap dipakai",
  pending: "Menunggu diproses",
  processing: "Sedang diproses",
  failed: "Gagal diproses",
};

const typeLabels = { pdf: "PDF", url: "Tautan", text: "Teks" };
const sourceDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });
export function sourceTitle(source: Source): string {
  return source.title || source.originalFilename || source.originalUrl || "Materi teks";
}
export function sourceMetadata(source: Source): string {
  const parts = [
    typeLabels[source.type],
    statusLabels[source.status],
    sourceDate.format(new Date(source.createdAt)),
  ];
  if (source.archivedAt) parts.push("Diarsipkan");
  parts.push(...sourceFileMetadata(source));
  return parts.join(" · ");
}

export function sourceOrigin(source: Source): string {
  if (source.type === "pdf") return source.originalFilename || "Dokumen PDF";
  if (source.type === "url" && source.originalUrl) {
    try {
      return new URL(source.originalUrl).hostname;
    } catch {
      return source.originalUrl;
    }
  }
  return source.type === "url" ? "Halaman web" : "Catatan teks";
}

export function sourceItemMetadata(source: Source): string {
  if (source.type !== "pdf") return source.type === "url" ? "Halaman web" : "Catatan teks";
  return sourceFileMetadata(source).join(" · ") || "Dokumen PDF";
}

function sourceFileMetadata(source: Source): string[] {
  const parts: string[] = [];
  if (source.pageCount !== undefined) parts.push(`${source.pageCount} halaman`);
  if (source.sizeBytes !== undefined)
    parts.push(`${(source.sizeBytes / 1024 / 1024).toFixed(1)} MiB`);
  return parts;
}
