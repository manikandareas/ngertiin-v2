import { ContextMenu, DropdownMenu } from "radix-ui";
import { useSources } from "../sources/api/use-sources";
import { statusLabels } from "./source-presentation";
import type { ModuleBuilderState } from "./use-module-builder";

export function SourceLibrary({
  state,
  menu,
}: {
  state: ModuleBuilderState;
  menu: "context" | "dropdown";
}) {
  const query = useSources({ limit: 20 });
  const Menu = menu === "context" ? ContextMenu : DropdownMenu;
  const sources = query.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <>
      {query.isPending ? (
        <Menu.Item disabled className="material-menu-item">
          Memuat materi…
        </Menu.Item>
      ) : null}
      {query.isError ? (
        <Menu.Item
          className="material-menu-item"
          onSelect={(event) => {
            event.preventDefault();
            void query.refetch();
          }}
        >
          Gagal memuat · Coba lagi
        </Menu.Item>
      ) : null}
      {!query.isPending && !query.isError && !sources.length ? (
        <Menu.Item disabled className="material-menu-item">
          Belum ada materi tersimpan
        </Menu.Item>
      ) : null}
      {sources.map((source) => {
        const selected = state.selected.some((item) => item.source.id === source.id);
        return (
          <Menu.Item
            key={source.id}
            disabled={state.busy || selected || state.count >= 10}
            className="material-menu-item"
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
      {query.hasNextPage ? (
        <Menu.Item
          className="material-menu-item"
          disabled={query.isFetchingNextPage}
          onSelect={(event) => {
            event.preventDefault();
            void query.fetchNextPage();
          }}
        >
          {query.isFetchingNextPage ? "Memuat…" : "Muat lebih banyak"}
        </Menu.Item>
      ) : null}
    </>
  );
}
