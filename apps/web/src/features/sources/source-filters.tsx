import type { SourceType } from "@ngertiin/contracts/api";
import { Tabs } from "radix-ui";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

type SourceFiltersProps = {
  search: string;
  type: SourceType | "";
  onSearchChange: (value: string) => void;
  onTypeChange: (value: SourceType | "") => void;
};
export function SourceFilters({ search, type, onSearchChange, onTypeChange }: SourceFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Tabs.List aria-label="Koleksi materi" className="inline-flex rounded-xl bg-muted p-1">
        {[
          { value: "false", label: "Aktif" },
          { value: "true", label: "Arsip" },
        ].map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="min-h-10 min-w-28 rounded-lg px-5 text-sm font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <Input
          aria-label="Cari materi"
          placeholder="Cari materi…"
          type="search"
          maxLength={500}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border sm:w-48"
        />
        <Select
          value={type || "all"}
          onValueChange={(value) => onTypeChange(value === "all" ? "" : (value as SourceType))}
        >
          <SelectTrigger aria-label="Jenis materi" className="h-10 w-36 sm:w-45">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Semua jenis</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="url">Web</SelectItem>
            <SelectItem value="text">Teks</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
