import type { Source } from "@ngertiin/contracts/api";
import { Plus } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { ContextMenu, DropdownMenu, Tabs } from "radix-ui";
import { useRef, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Button } from "../../components/ui/button";
import { menuContentClassName } from "../../components/ui/menu-styles";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { useSources } from "./api/use-sources";
import { SourceActionDialog } from "./source-action-dialog";
import type { SourceAction } from "./source-actions";
import { type AddSourceAction, SourceDialog } from "./source-dialog";
import { SourceFilters } from "./source-filters";
import { SourceItem } from "./source-item";
import { SourceMenu } from "./source-menu";
import { SourcePreview } from "./source-preview";
import { useSaveSource } from "./use-save-source";
import { useSourceForm } from "./use-source-form";

const emptyMessages = {
  filtered: {
    title: "Belum ada materi yang cocok",
    description: "Coba kata kunci atau jenis materi lain.",
  },
  archived: {
    title: "Arsip masih kosong",
    description: "Materi yang diarsipkan akan muncul di sini.",
  },
  active: {
    title: "Mulai kumpulkan bahan belajarmu",
    description: "Tambahkan PDF, tautan, atau catatan teks.",
  },
};

const filterParsers = {
  archived: parseAsStringLiteral(["true", "false"]).withDefault("false"),
  q: parseAsString.withDefault(""),
  type: parseAsStringLiteral(["", "pdf", "url", "text"]).withDefault(""),
};

export function SourceCollection() {
  const [{ archived, q: search, type }, setFilters] = useQueryStates(filterParsers);
  const q = useDebouncedValue(search, 300);
  const [add, setAdd] = useState<AddSourceAction | null>(null);
  const [preview, setPreview] = useState<Source | null>(null);
  const [action, setAction] = useState<SourceAction | null>(null);
  const focus = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLSpanElement>(null);
  const save = useSaveSource();
  const form = useSourceForm(save, () => {
    void setFilters(null);
  });
  const query = useSources({
    archived,
    q,
    ...(type ? { type } : {}),
  });
  const collection = archived === "true" ? "archived" : "active";
  const emptyCopy = emptyMessages[search || type ? "filtered" : collection];
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const returnFocus = () => {
    const target = focus.current;
    if (target?.isConnected) target.focus();
    else addButton.current?.querySelector("button")?.focus();
  };
  const openAdd = (next: AddSourceAction) => {
    focus.current = addButton.current?.querySelector("button") ?? null;
    setAdd(next);
  };
  return (
    <AppShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Materi saya</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Simpan bahan belajar untuk dipakai di berbagai modul.
          </p>
        </div>
        <span ref={addButton}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm" variant="outline">
                Tambah materi <Plus size={20} aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={menuContentClassName}
                align="end"
                onCloseAutoFocus={(event) => {
                  if (add || action) event.preventDefault();
                }}
              >
                <SourceMenu menu="dropdown" open={openAdd} disabled={form.busy} />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </span>
      </header>
      <Tabs.Root
        value={archived}
        onValueChange={(value) =>
          void setFilters({ archived: value === "true" ? "true" : "false" })
        }
        className="mt-7"
      >
        <SourceFilters
          search={search}
          type={type}
          onSearchChange={(q) => void setFilters({ q })}
          onTypeChange={(type) => void setFilters({ type })}
        />
        <Tabs.Content value={archived} className="mt-6">
          <ContextMenu.Root>
            <ContextMenu.Trigger asChild>
              <section aria-label="Daftar materi" className="min-h-64">
                {query.isPending ? (
                  <div role="status">
                    <span className="sr-only">Memuat materi…</span>
                    <div
                      aria-hidden="true"
                      className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4"
                    >
                      {["a", "b", "c", "d"].map((id) => (
                        <div key={id} className="px-3 pt-4">
                          <div className="h-100 rounded-xl bg-muted motion-safe:animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : !query.isError && !items.length ? (
                  <div className="rounded-2xl border border-dashed border-border p-8">
                    <h2 className="font-semibold">{emptyCopy.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{emptyCopy.description}</p>
                  </div>
                ) : null}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
                  {items.map((source) => (
                    <SourceItem
                      key={source.id}
                      source={source}
                      onPreview={(value, trigger) => {
                        focus.current = trigger;
                        setPreview(value);
                      }}
                      onAction={(value, trigger) => {
                        focus.current = trigger;
                        setAction(value);
                      }}
                    />
                  ))}
                </div>
              </section>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content
                className={menuContentClassName}
                onCloseAutoFocus={(event) => {
                  if (add) event.preventDefault();
                }}
              >
                <SourceMenu menu="context" open={openAdd} disabled={form.busy} />
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
          {query.isError ? (
            <div role="alert" className="mt-4 text-sm text-destructive">
              Materi belum dapat dimuat.{" "}
              <Button
                variant="outline"
                onClick={() =>
                  void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
                }
              >
                Coba lagi
              </Button>
            </div>
          ) : null}
          {query.hasNextPage ? (
            <Button
              className="mt-8"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Memuat…" : "Muat lebih banyak"}
            </Button>
          ) : null}
        </Tabs.Content>
      </Tabs.Root>
      <SourceDialog
        action={add}
        state={form}
        onClose={() => setAdd(null)}
        returnFocus={returnFocus}
      />
      {preview ? (
        <SourcePreview
          source={preview}
          onClose={() => setPreview(null)}
          returnFocus={returnFocus}
        />
      ) : null}
      {action ? (
        <SourceActionDialog
          key={`${action.source.id}-${action.kind}`}
          action={action}
          onClose={() => setAction(null)}
          returnFocus={returnFocus}
        />
      ) : null}
    </AppShell>
  );
}
