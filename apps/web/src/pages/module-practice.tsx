import { useAuth } from "@clerk/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, ClipboardList, Layers3, Plus } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { practiceApi } from "../features/practice/practice-api";
import { PracticeFilters } from "../features/practice/practice-filters";
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
    description: "Minta Teman Belajar membuat latihan dari materi modul ini.",
  },
};

const practiceKinds = {
  flashcard: { label: "Flashcard", icon: Layers3 },
  quiz: { label: "Kuis", icon: ClipboardList },
  exam: { label: "Exam", icon: BookOpen },
};

const practiceStatuses = {
  ready: { label: "Siap", dot: "bg-success" },
  generating: { label: "Sedang dibuat", dot: "bg-adaptive-edge" },
  failed: { label: "Gagal dibuat", dot: "bg-destructive" },
};

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

export default function ModulePracticePage() {
  const { moduleId } = useParams();
  const { getToken } = useAuth();
  const [{ collection, q: search, kind }, setFilters] = useQueryStates(filterParsers);
  const q = useDebouncedValue(search.trim(), 300);
  const api = practiceApi(getToken);
  const practices = useInfiniteQuery({
    queryKey: ["practices", moduleId, { collection, q, kind }],
    queryFn: ({ pageParam }) =>
      api.list(moduleId ?? "", {
        archived: collection === "archived",
        kind: kind || undefined,
        q: q || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: Boolean(moduleId),
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.data.some((practice) => practice.status === "generating"),
      )
        ? 3000
        : false,
  });
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
        <Button size="sm" variant="outline" asChild>
          <Link
            to={`/chat?moduleId=${moduleId}&draft=${encodeURIComponent("Buatkan latihan dari materi modul ini")}`}
          >
            Buat latihan <Plus size={20} aria-hidden="true" />
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
          <div
            aria-hidden="true"
            className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4"
          >
            {["a", "b", "c", "d"].map((id) => (
              <Card key={id} className="h-56 gap-0 p-5 motion-safe:animate-pulse">
                <div className="h-4 w-1/3 rounded bg-border" />
                <div className="mt-6 h-5 w-3/4 rounded bg-border" />
                <div className="mt-3 h-4 w-1/2 rounded bg-border" />
                <div className="mt-auto h-4 w-2/3 rounded bg-border" />
              </Card>
            ))}
          </div>
        </div>
      ) : practices.isError && entries.length === 0 ? (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-destructive/20 bg-background p-6"
        >
          <p className="font-semibold">Latihan belum dapat dimuat.</p>
          <Button className="mt-4" variant="outline" onClick={() => void practices.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-background p-8">
          <h2 className="text-lg font-bold">{emptyCopy.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{emptyCopy.description}</p>
        </div>
      ) : (
        <section
          aria-label="Daftar latihan"
          className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4"
        >
          {entries.map((practice) => {
            const kind = practiceKinds[practice.kind];
            const status = practiceStatuses[practice.status];
            const KindIcon = kind.icon;
            const latestAttempt = practice.latestAttempt;
            const attemptLabel = latestAttempt
              ? latestAttempt.status === "active"
                ? `${latestAttempt.answeredCount}/${practice.itemCount} dijawab`
                : latestAttempt.score === null
                  ? "Menunggu hasil"
                  : `Hasil terakhir ${latestAttempt.score}/100`
              : "Belum dikerjakan";

            return (
              <Card
                key={practice.id}
                className="min-w-0 gap-0 p-5 transition-colors hover:bg-muted/40 sm:p-6"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <KindIcon size={16} aria-hidden="true" />
                    {kind.label}
                  </span>
                  <span className="tabular-nums">
                    {practice.itemCount} {practice.kind === "flashcard" ? "kartu" : "soal"}
                  </span>
                </div>
                <h2 className="mt-5 line-clamp-2 min-h-12 wrap-anywhere text-base font-semibold leading-6 tracking-tight">
                  <Link
                    to={`/modules/${moduleId}/practice/${practice.id}`}
                    className="rounded-sm hover:text-link focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {practice.title}
                  </Link>
                </h2>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${status.dot}`}
                  />
                  <span className={practice.status === "failed" ? "text-destructive" : ""}>
                    {status.label}
                  </span>
                  <time className="ml-auto shrink-0 text-[11px]" dateTime={practice.createdAt}>
                    {dateFormat.format(new Date(practice.createdAt))}
                  </time>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-xs text-muted-foreground tabular-nums">{attemptLabel}</span>
                  <Button asChild size="icon" className="size-11 shrink-0">
                    <Link
                      to={`/modules/${moduleId}/practice/${practice.id}`}
                      aria-label={`Lihat latihan: ${practice.title}`}
                    >
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {practices.isFetchNextPageError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Latihan berikutnya belum dapat dimuat. Coba muat lagi.
        </p>
      ) : null}
      {practices.hasNextPage ? (
        <Button
          className="mt-8"
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
