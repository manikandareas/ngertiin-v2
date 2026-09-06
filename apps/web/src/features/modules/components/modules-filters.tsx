import type { ModuleProgressStatus, ModuleStatus } from "@ngertiin/contracts/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

type ModulesFiltersProps = {
  collection: "active" | "archived";
  status: ModuleStatus | "";
  progressStatus: ModuleProgressStatus | "";
  onCollectionChange: (collection: "active" | "archived") => void;
  onStatusChange: (status: ModuleStatus | "") => void;
  onProgressChange: (status: ModuleProgressStatus | "") => void;
};

export function ModulesFilters({
  collection,
  status,
  progressStatus,
  onCollectionChange,
  onStatusChange,
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
      <div className="flex flex-wrap items-center gap-2">
        {collection === "active" ? (
          <Select
            value={status || "all"}
            onValueChange={(value) =>
              onStatusChange(value === "all" ? "" : (value as ModuleStatus))
            }
          >
            <SelectTrigger aria-label="Status modul" className="h-10 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="generating">Sedang dibuat</SelectItem>
              <SelectItem value="ready">Siap dipelajari</SelectItem>
              <SelectItem value="failed">Perlu dicoba lagi</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <Select
          value={progressStatus || "all"}
          onValueChange={(value) =>
            onProgressChange(value === "all" ? "" : (value as ModuleProgressStatus))
          }
        >
          <SelectTrigger aria-label="Progres belajar" className="h-10 w-[190px]">
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
