import type { SourceType } from "@ngertiin/contracts/api";
import { Input } from "../../components/ui/input";

type SourceFiltersProps = {
  search: string;
  type: SourceType | "";
  onSearchChange: (value: string) => void;
  onTypeChange: (value: SourceType | "") => void;
};
export function SourceFilters({ search, type, onSearchChange, onTypeChange }: SourceFiltersProps) {
  return (
    <div className="my-5 flex flex-wrap items-center gap-3">
      <Input
        aria-label="Cari materi"
        placeholder="Cari judul, nama file, atau URL…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="min-w-48 flex-1"
      />
      <select
        aria-label="Jenis materi"
        value={type}
        onChange={(event) => onTypeChange(event.target.value as SourceType | "")}
        className="h-10 rounded-lg border bg-background px-3 text-sm"
      >
        <option value="">Semua jenis</option>
        <option value="pdf">PDF</option>
        <option value="url">Tautan</option>
        <option value="text">Teks</option>
      </select>
      <span className="text-xs text-muted-foreground">Terbaru dahulu</span>
    </div>
  );
}
