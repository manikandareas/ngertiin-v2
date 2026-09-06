import { Plus } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ModuleProgressStatus, ModuleStatus } from "@ngertiin/contracts/api";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useModules } from "../features/modules/api/use-modules";
import { ModuleCard } from "../features/modules/components/module-card";
import { ModulesFilters } from "../features/modules/components/modules-filters";

export default function ModulesPage() {
  const [collection, setCollection] = useState<"active" | "archived">("active");
  const [status, setStatus] = useState<ModuleStatus | "">("");
  const [progressStatus, setProgressStatus] = useState<ModuleProgressStatus | "">("");
  const modules = useModules({
    ...(collection === "archived" ? { status: "archived" as const } : status ? { status } : {}),
    ...(progressStatus ? { progressStatus } : {}),
  });
  const items = modules.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <AppShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modul saya</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Semua materi dan perjalanan belajarmu, di satu tempat.
          </p>
        </div>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/modules/new">
            Buat modul <HugeiconsIcon icon={Plus} size={20} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <ModulesFilters
        collection={collection}
        status={status}
        progressStatus={progressStatus}
        onCollectionChange={(value) => {
          setCollection(value);
          setStatus("");
          setProgressStatus("");
        }}
        onStatusChange={setStatus}
        onProgressChange={setProgressStatus}
      />

      {modules.isPending ? (
        <div role="status" className="mt-6">
          <span className="sr-only">Memuat modul…</span>
          <div
            aria-hidden="true"
            className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4"
          >
            {["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => (
              <Card key={id} className="h-72 gap-0 p-4 sm:p-5 motion-safe:animate-pulse">
                <div className="h-4 w-3/4 rounded bg-border" />
                <div className="mt-3 h-4 w-1/2 rounded bg-border" />
                <div className="mt-8 h-3 w-2/3 rounded bg-border" />
              </Card>
            ))}
          </div>
        </div>
      ) : modules.isError && items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-destructive/20 bg-background p-6">
          <p className="font-semibold">Modul belum dapat dimuat.</p>
          <Button className="mt-4" onClick={() => modules.refetch()} variant="outline">
            Coba lagi
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-background p-8">
          <h2 className="text-lg font-bold">Belum ada modul pada filter ini</h2>
          <p className="mt-2 text-muted-foreground">
            Ubah filter atau{" "}
            <Link className="text-link underline" to="/modules/new">
              buat modul baru
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
          {items.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      )}

      {modules.isFetchNextPageError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Modul berikutnya belum dapat dimuat. Coba muat lagi.
        </p>
      ) : null}
      {modules.hasNextPage ? (
        <Button
          className="mt-8"
          disabled={modules.isFetching}
          onClick={() => modules.fetchNextPage()}
          variant="outline"
        >
          {modules.isFetchingNextPage
            ? "Memuat…"
            : modules.isFetchNextPageError
              ? "Coba muat lagi"
              : "Muat lagi"}
        </Button>
      ) : null}
    </AppShell>
  );
}
