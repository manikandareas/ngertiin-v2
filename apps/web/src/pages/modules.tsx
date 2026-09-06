import type { ModuleProgressStatus, ModuleStatus } from "@ngertiin/contracts/api";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { useModules } from "../features/modules/api/use-modules";
import { ModuleCard } from "../features/modules/components/module-card";

export default function ModulesPage() {
  const [status, setStatus] = useState<ModuleStatus | "">("");
  const [progressStatus, setProgressStatus] = useState<ModuleProgressStatus | "">("");
  const modules = useModules({
    ...(status ? { status } : {}),
    ...(progressStatus ? { progressStatus } : {}),
  });
  const items = modules.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Library</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Semua Module</h1>
        </div>
      </div>

      <div className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Status Module
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
            onChange={(event) => setStatus(event.target.value as ModuleStatus | "")}
            value={status}
          >
            <option value="">Aktif (tanpa archived)</option>
            <option value="generating">Sedang dibuat</option>
            <option value="ready">Siap</option>
            <option value="failed">Gagal</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Progress
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
            onChange={(event) => setProgressStatus(event.target.value as ModuleProgressStatus | "")}
            value={progressStatus}
          >
            <option value="">Semua progress</option>
            <option value="not_started">Belum dimulai</option>
            <option value="in_progress">Sedang dipelajari</option>
            <option value="completed">Selesai</option>
          </select>
        </label>
      </div>

      {modules.isPending ? (
        <p className="mt-8 text-sm text-slate-500">Memuat Module…</p>
      ) : modules.isError ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-white p-6">
          <p className="font-semibold">Library belum dapat dimuat.</p>
          <Button className="mt-4" onClick={() => modules.refetch()} variant="outline">
            Coba lagi
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8">
          <h2 className="text-xl font-bold">Tidak ada Module pada filter ini</h2>
          <p className="mt-2 text-slate-600">
            Ubah filter atau{" "}
            <Link className="text-link underline" to="/dashboard#module-composer">
              mulai modul baru dari Beranda
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      )}

      {modules.hasNextPage ? (
        <Button
          className="mt-8"
          disabled={modules.isFetchingNextPage}
          onClick={() => modules.fetchNextPage()}
          variant="outline"
        >
          {modules.isFetchingNextPage ? "Memuat…" : "Muat lagi"}
        </Button>
      ) : null}
    </AppShell>
  );
}
