import { useDeferredValue, useState } from "react";
import { Button } from "../../../components/ui/button";
import { DialogFrame } from "../../../components/ui/dialog-frame";
import { Input } from "../../../components/ui/input";
import { useModules } from "../../modules/api/use-modules";

type ChatModulePickerProps = {
  onSelect: (module: { id: string; title: string | null }) => void;
  onClose: () => void;
  returnFocus: () => void;
  startsNew?: boolean;
};

export function ChatModulePicker({
  onSelect,
  onClose,
  returnFocus,
  startsNew = false,
}: ChatModulePickerProps) {
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const modules = useModules({ q: q || undefined, status: "ready,archived" });
  const items = [
    ...new Map(
      modules.data?.pages.flatMap((page) => page.data).map((item) => [item.id, item]),
    ).values(),
  ];
  return (
    <DialogFrame
      open
      title="Tambahkan konteks"
      description={
        startsNew
          ? "Memilih modul akan membuka chat baru. Percakapan ini tetap tersimpan."
          : "Pilih satu modul sebagai bahan diskusi. Kamu juga bisa bertanya tanpa modul."
      }
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cari modul…"
        aria-label="Cari modul"
      />
      <div className="mt-4 max-h-[50dvh] space-y-2 overflow-y-auto">
        {modules.isPending ? (
          <p role="status" className="p-3 text-sm text-muted-foreground">
            Memuat modul…
          </p>
        ) : null}
        {modules.isError ? (
          <div role="alert">
            <p>Modul belum dapat dimuat.</p>
            <Button variant="link" onClick={() => void modules.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : null}
        {items.map((module) => (
          <button
            key={module.id}
            type="button"
            className="w-full rounded-xl border p-4 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => onSelect(module)}
          >
            <span className="block font-semibold">{module.title ?? "Modul belajar"}</span>
            <span className="text-xs text-muted-foreground">
              {module.status === "archived"
                ? "Diarsipkan · materi tetap dapat dibaca"
                : "Materi dan progres belajar"}
            </span>
          </button>
        ))}
        {!modules.isPending && !modules.isError && !items.length ? (
          <p className="p-3 text-sm text-muted-foreground">Belum ada modul yang cocok.</p>
        ) : null}
        {modules.hasNextPage ? (
          <Button
            variant="link"
            disabled={modules.isFetchingNextPage}
            onClick={() => void modules.fetchNextPage()}
          >
            Muat modul lainnya
          </Button>
        ) : null}
      </div>
    </DialogFrame>
  );
}
