import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { PracticeCard, PracticeCardSkeleton } from "../features/practice/components/practice-card";
import { PracticeFilters } from "../features/practice/practice-filters";
import { usePractices } from "../features/practice/use-practices";
import { useDebouncedValue } from "../lib/use-debounced-value";

const filterParsers = {
  collection: parseAsStringLiteral(["active", "archived"]).withDefault("active"),
  q: parseAsString.withDefault(""),
  kind: parseAsStringLiteral(["", "quiz", "flashcard", "exam"]).withDefault(""),
};

const emptyMessages = {
  filtered: {
    title: "Belum ada latihan yang cocok",
    description: "Coba kata kunci atau jenis latihan lain.",
  },
  archived: {
    title: "Arsip masih kosong",
    description: "Latihan yang diarsipkan akan muncul di sini.",
  },
  active: {
    title: "Belum ada latihan",
    description: "Buat flashcard, kuis, atau exam dari materi modul ini.",
  },
};

const gridClassName = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5";

export default function ModulePracticePage() {
  const { moduleId } = useParams();
  const [{ collection, q: search, kind }, setFilters] = useQueryStates(filterParsers);
  const q = useDebouncedValue(search.trim(), 300);
  const practices = usePractices(moduleId, { collection, q, kind });
  const entries = practices.data?.pages.flatMap((page) => page.data) ?? [];
  const emptyCopy = emptyMessages[search || kind ? "filtered" : collection];

  return (
    <AppShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Latihan</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Flashcard, kuis, dan exam dari materi modul ini.
          </p>
        </div>
        <Button size="sm" variant="outline" className="normal-case" asChild>
          <Link to={`/modules/${moduleId}/practice/new`}>
            Buat latihan{" "}
            <HugeiconsIcon icon={Add01Icon} strokeWidth={1.5} size={20} aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <PracticeFilters
        collection={collection}
        search={search}
        kind={kind}
        onCollectionChange={(collection) => void setFilters({ collection })}
        onSearchChange={(q) => void setFilters({ q })}
        onKindChange={(kind) => void setFilters({ kind })}
      />

      {practices.isPending ? (
        <div role="status" className="mt-6">
          <span className="sr-only">Memuat latihan…</span>
          <div aria-hidden="true" className={gridClassName}>
            {["a", "b", "c", "d", "e", "f"].map((id) => (
              <PracticeCardSkeleton key={id} />
            ))}
          </div>
        </div>
      ) : practices.isError && entries.length === 0 ? (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-destructive/20 bg-background p-6"
        >
          <p className="font-semibold">Latihan belum dapat dimuat.</p>
          <Button
            className="mt-4 normal-case"
            variant="outline"
            onClick={() => void practices.refetch()}
          >
            Coba lagi
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-background p-8">
          <h2 className="text-lg font-bold">{emptyCopy.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{emptyCopy.description}</p>
        </div>
      ) : (
        <section aria-label="Daftar latihan" className={`mt-6 ${gridClassName}`}>
          {entries.map((practice) => (
            <PracticeCard key={practice.id} practice={practice} />
          ))}
        </section>
      )}

      {practices.isFetchNextPageError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Latihan berikutnya belum dapat dimuat. Coba muat lagi.
        </p>
      ) : null}
      {practices.hasNextPage ? (
        <Button
          className="mt-8 normal-case"
          variant="outline"
          disabled={practices.isFetching}
          onClick={() => void practices.fetchNextPage()}
        >
          {practices.isFetchingNextPage
            ? "Memuat…"
            : practices.isFetchNextPageError
              ? "Coba muat lagi"
              : "Muat lagi"}
        </Button>
      ) : null}
    </AppShell>
  );
}
