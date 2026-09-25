import type { PracticeSummary } from "@ngertiin/contracts/api";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

type PracticeKind = PracticeSummary["kind"];

export function PracticeFilters({
  collection,
  search,
  kind,
  onCollectionChange,
  onSearchChange,
  onKindChange,
}: {
  collection: "active" | "archived";
  search: string;
  kind: PracticeKind | "";
  onCollectionChange: (collection: "active" | "archived") => void;
  onSearchChange: (search: string) => void;
  onKindChange: (kind: PracticeKind | "") => void;
}) {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
      <fieldset className="inline-flex rounded-xl bg-muted p-1" aria-label="Koleksi latihan">
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
          aria-label="Cari latihan"
          placeholder="Cari latihan…"
          maxLength={500}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border sm:w-48"
        />
        <Select
          value={kind || "all"}
          onValueChange={(value) => onKindChange(value === "all" ? "" : (value as PracticeKind))}
        >
          <SelectTrigger aria-label="Jenis latihan" className="h-10 w-36 sm:w-45">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Semua jenis</SelectItem>
            <SelectItem value="quiz">Kuis</SelectItem>
            <SelectItem value="flashcard">Flashcard</SelectItem>
            <SelectItem value="exam">Exam</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
