import { ContextMenu, DropdownMenu } from "radix-ui";
import { useState } from "react";
import { Input } from "../../components/ui/input";
import { menuItemClassName } from "../../components/ui/menu-styles";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { useSources } from "../sources/api/use-sources";
import { statusLabels } from "../sources/source-presentation";
import type { ModuleBuilderState } from "./use-module-builder";

export function SourceLibrary({
  state,
  menu,
}: {
  state: ModuleBuilderState;
  menu: "context" | "dropdown";
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const query = useSources({ limit: 5, q: debouncedSearch || undefined });
  const Menu = menu === "context" ? ContextMenu : DropdownMenu;
  const sources = query.data?.pages[0]?.data.slice(0, 5) ?? [];
  return (
    <>
      <div className="p-2">
        <Input
          type="search"
          aria-label="Cari materi saya"
          placeholder="Cari materi…"
          className="h-9 text-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape" && event.key !== "Tab") {
              event.stopPropagation();
            }
          }}
        />
      </div>
      {query.isPending ? (
        <Menu.Item disabled className={menuItemClassName}>
          Memuat materi…
        </Menu.Item>
      ) : null}
      {query.isError ? (
        <Menu.Item
          className={menuItemClassName}
          onSelect={(event) => {
            event.preventDefault();
            void query.refetch();
          }}
        >
          Gagal memuat · Coba lagi
        </Menu.Item>
      ) : null}
      {!query.isPending && !query.isError && !sources.length ? (
        <Menu.Item disabled className={menuItemClassName}>
          {debouncedSearch ? "Materi tidak ditemukan" : "Belum ada materi tersimpan"}
        </Menu.Item>
      ) : null}
      {sources.map((source) => {
        const selected = state.selected.some((item) => item.source.id === source.id);
        return (
          <Menu.Item
            key={source.id}
            disabled={state.busy || selected || state.count >= 10}
            className={menuItemClassName}
            onSelect={() => state.toggle(source)}
          >
            <span className="min-w-0">
              <span className="block truncate">{source.title ?? "Materi tanpa judul"}</span>
              <span className="block text-xs text-muted-foreground">
                {selected
                  ? "Sudah ditambahkan"
                  : `${source.type.toUpperCase()} · ${statusLabels[source.status]}`}
              </span>
            </span>
          </Menu.Item>
        );
      })}
    </>
  );
}
