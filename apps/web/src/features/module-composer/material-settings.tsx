import { Button } from "../../components/ui/button";
import { composerFieldClassName as field } from "./composer-presentation";
import type { ComposerState } from "./use-composer";
export function MaterialSettings({ state }: { state: ComposerState }) {
  return (
    <>
      <label className="block text-sm">
        Judul materi baru (opsional)
        <input
          className={field}
          value={state.title}
          onChange={(e) => state.setTitle(e.target.value)}
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!state.text.trim()}
        onClick={() => void state.add("text")}
      >
        Tambahkan teks ke daftar
      </Button>
      <p className="text-caption text-muted-foreground">
        Urutan ini menjadi prioritas materi modul.
      </p>
      {state.selected.map((item, index) => (
        <div key={item.source.id} className="space-y-3 border-t pt-3">
          <p className="break-words text-sm font-bold">
            {index + 1}. {item.source.title ?? "Materi tanpa judul"}
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-button border bg-background p-2 text-sm"
              aria-label={`Peran materi ${index + 1}`}
              value={item.role}
              onChange={(e) => state.role(item.source.id, e.target.value as typeof item.role)}
            >
              <option value="primary">Utama</option>
              <option value="reference">Referensi</option>
              <option value="supplementary">Pelengkap</option>
            </select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={index === 0}
              onClick={() => state.move(index, -1)}
            >
              Naik
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={index === state.selected.length - 1}
              onClick={() => state.move(index, 1)}
            >
              Turun
            </Button>
          </div>
          {item.source.type === "pdf" ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!item.selector}
                  onChange={(e) =>
                    state.setSelected((current) =>
                      current.map((value) =>
                        value.source.id === item.source.id
                          ? {
                              ...value,
                              selector: e.target.checked
                                ? {
                                    pages: {
                                      from: 1,
                                      to: item.source.pageCount ?? 1,
                                    },
                                  }
                                : undefined,
                            }
                          : value,
                      ),
                    )
                  }
                />
                Pilih rentang halaman
              </label>
              {item.selector ? (
                <div className="flex flex-wrap gap-3">
                  {(["from", "to"] as const).map((key) => (
                    <label key={key} className="text-sm">
                      {key === "from" ? "Dari" : "Sampai"}
                      <input
                        type="number"
                        min={1}
                        max={item.source.pageCount ?? 1}
                        className={`${field} max-w-24`}
                        value={item.selector?.pages[key]}
                        onChange={(e) =>
                          state.setSelected((current) =>
                            current.map((value) =>
                              value.source.id === item.source.id && value.selector
                                ? {
                                    ...value,
                                    selector: {
                                      pages: {
                                        ...value.selector.pages,
                                        [key]: Number(e.target.value),
                                      },
                                    },
                                  }
                                : value,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ))}
    </>
  );
}
