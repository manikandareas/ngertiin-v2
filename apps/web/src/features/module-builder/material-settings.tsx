import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { statusLabels } from "./source-presentation";
import type { ModuleBuilderState } from "./use-module-builder";

const roleDescriptions = {
  primary: "Menjadi dasar utama penyusunan modul. Minimal satu materi harus berperan utama.",
  reference: "Memberikan konteks dan rujukan untuk memperjelas materi utama.",
  supplementary: "Menambah contoh atau penjelasan pendukung pada modul.",
};

export function MaterialSettings({
  state,
  sourceId,
}: {
  state: ModuleBuilderState;
  sourceId: string;
}) {
  const item = state.selected.find((item) => item.source.id === sourceId);
  if (!item) return null;
  const pages = item.selector?.pages;
  const pageCount = item.source.pageCount;
  const invalidRange =
    pages &&
    (!Number.isInteger(pages.from) ||
      !Number.isInteger(pages.to) ||
      pages.from < 1 ||
      pages.to < pages.from ||
      (pageCount !== undefined && pages.to > pageCount));
  return (
    <div className="space-y-7">
      <div className="border-b border-muted pb-5">
        <p className="break-words text-sm font-semibold leading-6">
          {item.source.title ?? "Materi tanpa judul"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.source.type.toUpperCase()}
          {pageCount ? ` · ${pageCount} halaman` : ""} · {statusLabels[item.source.status]}
        </p>
      </div>
      <div className="space-y-2.5">
        <label htmlFor="material-role" className="block text-sm font-medium">
          Peran materi
        </label>
        <Select
          value={item.role}
          disabled={state.busy}
          onValueChange={(value) => {
            if (value === "primary" || value === "reference" || value === "supplementary")
              state.role(sourceId, value);
          }}
        >
          <SelectTrigger
            id="material-role"
            aria-describedby="material-role-help"
            className="h-11 w-full rounded-xl shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="z-70 rounded-xl">
            <SelectItem value="primary">Utama</SelectItem>
            <SelectItem value="reference">Referensi</SelectItem>
            <SelectItem value="supplementary">Pelengkap</SelectItem>
          </SelectContent>
        </Select>
        <p id="material-role-help" className="text-xs leading-5 text-muted-foreground">
          {roleDescriptions[item.role]}
        </p>
      </div>
      {item.source.type === "pdf" ? (
        <div className="space-y-5">
          <div className="space-y-2.5">
            <label htmlFor="material-page-scope" className="block text-sm font-medium">
              Halaman yang dipelajari
            </label>
            <Select
              value={pages ? "custom" : "all"}
              disabled={state.busy || !pageCount}
              onValueChange={(value) =>
                state.setSelected((current) =>
                  current.map((entry) =>
                    entry.source.id === sourceId
                      ? {
                          ...entry,
                          selector:
                            value === "custom"
                              ? { pages: { from: 1, to: pageCount ?? 1 } }
                              : undefined,
                        }
                      : entry,
                  ),
                )
              }
            >
              <SelectTrigger
                id="material-page-scope"
                aria-describedby="material-pages-help"
                className="h-11 w-full rounded-xl shadow-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-70 rounded-xl">
                <SelectItem value="all">Semua halaman</SelectItem>
                <SelectItem value="custom">Rentang tertentu</SelectItem>
              </SelectContent>
            </Select>
            <p id="material-pages-help" className="text-xs leading-5 text-muted-foreground">
              {!pageCount
                ? "Pilihan halaman tersedia setelah PDF selesai diproses."
                : pages
                  ? "Hanya halaman dalam rentang ini yang digunakan."
                  : "Seluruh isi PDF digunakan untuk menyusun modul."}
            </p>
          </div>
          {pages ? (
            <div>
              <div className="grid grid-cols-2 gap-4">
                {(["from", "to"] as const).map((key) => (
                  <div key={key} className="space-y-2.5">
                    <label htmlFor={`material-page-${key}`} className="block text-sm font-medium">
                      {key === "from" ? "Dari halaman" : "Sampai halaman"}
                    </label>
                    <Input
                      id={`material-page-${key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={pageCount}
                      aria-invalid={!!invalidRange}
                      aria-describedby={
                        invalidRange ? "material-range-error" : "material-pages-help"
                      }
                      value={pages[key] || ""}
                      onChange={(event) =>
                        state.setSelected((current) =>
                          current.map((entry) =>
                            entry.source.id === sourceId && entry.selector
                              ? {
                                  ...entry,
                                  selector: {
                                    pages: {
                                      ...entry.selector.pages,
                                      [key]: Number(event.target.value),
                                    },
                                  },
                                }
                              : entry,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              {invalidRange ? (
                <p
                  id="material-range-error"
                  role="alert"
                  className="mt-3 text-xs leading-5 text-destructive"
                >
                  Gunakan halaman 1–{pageCount ?? "akhir"}, dengan halaman akhir tidak lebih kecil
                  dari halaman awal.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
