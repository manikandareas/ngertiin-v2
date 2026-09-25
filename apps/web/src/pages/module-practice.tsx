import { useAuth } from "@clerk/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { practiceApi } from "../features/practice/practice-api";

export default function ModulePracticePage() {
  const { moduleId } = useParams();
  const { getToken } = useAuth();
  const api = practiceApi(getToken);
  const practices = useInfiniteQuery({
    queryKey: ["practices", moduleId],
    queryFn: ({ pageParam }) => api.list(moduleId ?? "", pageParam),
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
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-7 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Modul belajar</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Latihan</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Flashcard, kuis, dan exam yang dibuat bersama Teman Belajar.
            </p>
          </div>
          <Button asChild size="sm">
            <Link
              to={`/chat?moduleId=${moduleId}&draft=${encodeURIComponent("Buatkan latihan dari materi modul ini")}`}
            >
              <Plus className="size-4" />
              Buat latihan
            </Link>
          </Button>
        </header>
        {practices.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Memuat latihan…
          </p>
        ) : null}
        {practices.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Latihan belum dapat dimuat.{" "}
            <button type="button" className="underline" onClick={() => void practices.refetch()}>
              Coba lagi
            </button>
          </p>
        ) : null}
        {!practices.isPending && entries.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <BookOpen className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 font-medium">Belum ada latihan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Minta Teman Belajar membuat latihan dari materi modul ini.
            </p>
          </div>
        ) : null}
        <div className="grid gap-3">
          {entries.map((practice) => (
            <Link
              key={practice.id}
              to={`/modules/${moduleId}/practice/${practice.id}`}
              className="rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {practice.kind === "flashcard"
                      ? "Flashcard"
                      : practice.kind === "quiz"
                        ? "Kuis"
                        : "Exam"}{" "}
                    · {practice.itemCount} {practice.kind === "flashcard" ? "kartu" : "soal"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">{practice.title}</h2>
                  {practice.latestAttempt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {practice.latestAttempt.status === "active"
                        ? `${practice.latestAttempt.answeredCount}/${practice.itemCount} dijawab`
                        : practice.latestAttempt.score === null
                          ? "Menunggu hasil"
                          : `Hasil terakhir ${practice.latestAttempt.score}/100`}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {practice.status === "ready"
                    ? "Siap"
                    : practice.status === "failed"
                      ? "Gagal"
                      : "Dibuat"}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {practices.hasNextPage ? (
          <Button
            size="sm"
            variant="outline"
            disabled={practices.isFetchingNextPage}
            onClick={() => void practices.fetchNextPage()}
          >
            {practices.isFetchingNextPage ? "Memuat…" : "Tampilkan latihan lain"}
          </Button>
        ) : null}
      </div>
    </AppShell>
  );
}
