import type { ModuleProgressStatus } from "@ngertiin/contracts/api";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

type ModulesFiltersProps = {
  collection: "active" | "archived";
  search: string;
  progressStatus: ModuleProgressStatus | "";
  onCollectionChange: (collection: "active" | "archived") => void;
  onSearchChange: (search: string) => void;
  onProgressChange: (status: ModuleProgressStatus | "") => void;
};

export function ModulesFilters({
  collection,
  search,
  progressStatus,
  onCollectionChange,
  onSearchChange,
  onProgressChange,
}: ModulesFiltersProps) {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
      <fieldset className="inline-flex rounded-xl bg-muted p-1" aria-label="Koleksi modul">
        {(
          [
            { value: "active", label: "Aktif" },
            { value: "archived", label: "Arsip" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={collection === tab.value}
            onClick={() => onCollectionChange(tab.value)}
            className={`min-h-10 min-w-28 rounded-lg px-5 text-sm font-semibold motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-ring ${collection === tab.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </fieldset>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <Input
          type="search"
          aria-label="Cari modul"
          placeholder="Cari modul…"
          maxLength={500}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border sm:w-48"
        />
        <Select
          value={progressStatus || "all"}
          onValueChange={(value) =>
            onProgressChange(value === "all" ? "" : (value as ModuleProgressStatus))
          }
        >
          <SelectTrigger aria-label="Progres belajar" className="h-10 w-40 sm:w-47.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Semua progres</SelectItem>
            <SelectItem value="not_started">Belum dimulai</SelectItem>
            <SelectItem value="in_progress">Sedang dipelajari</SelectItem>
            <SelectItem value="completed">Selesai</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
