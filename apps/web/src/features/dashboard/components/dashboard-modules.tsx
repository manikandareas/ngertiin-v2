import { ArrowRightDoubleIcon, BookOpen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dashboard } from "@ngertiin/contracts/api";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardModuleRow } from "./dashboard-module-row";

export function DashboardModules({
  modules,
  continueLearning,
}: Pick<Dashboard, "modules" | "continueLearning">) {
  const [search, setSearch] = useState("");
  const choices = continueLearning
    ? [
        continueLearning.module,
        ...modules.filter((module) => module.id !== continueLearning.module.id),
      ]
    : modules;
  const visible = choices.filter((module) =>
    (module.title ?? "Modul baru")
      .toLocaleLowerCase("id-ID")
      .includes(search.trim().toLocaleLowerCase("id-ID")),
  );
  return (
    <section
      aria-labelledby="modules-heading"
      className="min-w-0 rounded-card border bg-card p-5 sm:p-6"
    >
      <header className="mb-5 flex flex-wrap items-center gap-3 sm:gap-5">
        <h2 id="modules-heading" className="flex items-center gap-2 text-base font-semibold">
          <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
          Modul saya
        </h2>
        <label className="order-3 w-full sm:order-none sm:w-48">
          <span className="sr-only">Cari modul di dashboard</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama modul…"
            className="h-9 w-full rounded-full border bg-background px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <Link
          to="/modules"
          className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-sm px-1 text-caption font-medium text-link hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          Semua modul
          <HugeiconsIcon icon={ArrowRightDoubleIcon} size={14} aria-hidden="true" />
        </Link>
      </header>
      {visible.length ? (
        <ul className="space-y-1">
          {visible.map((module) => (
            <li key={module.id}>
              <DashboardModuleRow module={module} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-6 text-sm text-muted-foreground">
          <p>
            {search
              ? "Tidak ada modul yang cocok di dashboard ini."
              : "Belum ada modul. Mulai dengan materi yang ingin kamu pahami."}
          </p>
          {!search && (
            <Link
              to="/dashboard#module-composer"
              className="mt-3 inline-block rounded-sm font-bold text-link hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Buat modul pertama →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
