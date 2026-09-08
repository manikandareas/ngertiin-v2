import type { Source, SourceType } from "@ngertiin/contracts/api";
import { ContextMenu, DropdownMenu, Tabs } from "radix-ui";
import { useDeferredValue, useRef, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Button } from "../../components/ui/button";
import { menuContentClassName } from "../../components/ui/menu-styles";
import { useSources } from "./api/use-sources";
import { SourceActionDialog } from "./source-action-dialog";
import type { SourceAction } from "./source-actions";
import { type AddSourceAction, SourceDialog } from "./source-dialog";
import { SourceFilters } from "./source-filters";
import { SourceMenu } from "./source-menu";
import { SourcePreview } from "./source-preview";
import { SourceRow } from "./source-row";
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
export function SourceCollection() {
  const [archived, setArchived] = useState<"true" | "false">("false");
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search);
  const [type, setType] = useState<SourceType | "">("");
  const [add, setAdd] = useState<AddSourceAction | null>(null);
  const [preview, setPreview] = useState<Source | null>(null);
  const [action, setAction] = useState<SourceAction | null>(null);
  const focus = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLSpanElement>(null);
  const save = useSaveSource();
  const form = useSourceForm(save, () => {
    setArchived("false");
    setSearch("");
    setType("");
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
          <h1 className="text-2xl font-bold">Materi saya</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Simpan bahan belajar untuk dipakai di berbagai modul.
          </p>
        </div>
        <span ref={addButton}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button>Tambah materi</Button>
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
        onValueChange={(value) => setArchived(value === "true" ? "true" : "false")}
        className="mt-6"
      >
        <Tabs.List aria-label="Koleksi materi" className="flex gap-2 border-b pb-3">
          <Tabs.Trigger
            className="rounded-lg px-4 py-2 data-[state=active]:bg-secondary"
            value="false"
          >
            Aktif
          </Tabs.Trigger>
          <Tabs.Trigger
            className="rounded-lg px-4 py-2 data-[state=active]:bg-secondary"
            value="true"
          >
            Arsip
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={archived}>
          <SourceFilters
            search={search}
            type={type}
            onSearchChange={setSearch}
            onTypeChange={setType}
          />
          <ContextMenu.Root>
            <ContextMenu.Trigger asChild>
              <section aria-label="Daftar materi" className="min-h-64 rounded-card border">
                {query.isPending ? (
                  <p role="status" className="p-6">
                    Memuat materi…
                  </p>
                ) : !query.isError && !items.length ? (
                  <div className="p-8">
                    <h2 className="font-semibold">{emptyCopy.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{emptyCopy.description}</p>
                  </div>
                ) : null}
                {items.map((source) => (
                  <SourceRow
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
              className="mt-6"
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
