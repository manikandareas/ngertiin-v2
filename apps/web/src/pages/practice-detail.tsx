import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { BackHeader } from "../components/back-header";
import { PracticeAttemptHistory } from "../features/practice/components/practice-attempt-history";
import { PracticeCard } from "../features/practice/components/practice-card";
import { PracticeDetailContent } from "../features/practice/components/practice-detail-content";
import { PracticeDetailHeader } from "../features/practice/components/practice-detail-header";
import { practiceApi } from "../features/practice/practice-api";
import { usePageTitle } from "../routes/page-metadata";

export default function PracticeDetailPage() {
  const { moduleId, practiceId } = useParams();
  const { getToken } = useAuth();
  const api = practiceApi(getToken);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const practice = useQuery({
    queryKey: ["practice", practiceId],
    queryFn: () => api.detail(practiceId ?? ""),
    enabled: Boolean(practiceId),
    refetchInterval: (query) =>
      query.state.data?.status === "ready" || query.state.data?.status === "failed" ? false : 3000,
  });
  const attempts = useQuery({
    queryKey: ["practice-attempts", practiceId],
    queryFn: () => api.attempts(practiceId ?? ""),
    enabled: Boolean(practiceId && practice.data?.status === "ready"),
  });
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await client.invalidateQueries({ queryKey: ["practice", practiceId] });
      await client.invalidateQueries({ queryKey: ["practices", moduleId] });
    } catch {
      setError("Tindakan belum berhasil. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };
  const data = practice.data;
  usePageTitle(data?.title);
  const firstItem = data?.items[0]?.content;
  const preview = firstItem
    ? {
        text: firstItem.type === "flashcard" ? firstItem.front : firstItem.question,
        options: firstItem.type === "multiple_choice" ? firstItem.options : [],
      }
    : null;
  const active = attempts.data?.some((attempt) => attempt.status === "active");
  return (
    <AppShell workspace>
      <BackHeader to={`/modules/${moduleId}/practice`} label="Kembali ke Latihan" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 pt-8 pb-16 sm:px-8 lg:pt-16">
          {practice.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Memuat latihan…
            </p>
          ) : null}
          {practice.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Latihan belum dapat dimuat.
            </p>
          ) : null}
          {data ? (
            <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 2xl:gap-16">
              <aside className="mx-auto w-full max-w-60 lg:sticky lg:top-8 lg:self-start">
                <PracticeCard practice={{ ...data, preview }} linked={false} />
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Dibuat{" "}
                  {new Date(data.createdAt).toLocaleDateString("id-ID", { dateStyle: "long" })}
                </p>
              </aside>
              <div className="min-w-0">
                <PracticeDetailHeader
                  practice={data}
                  busy={busy}
                  onRename={() => {
                    const title = window.prompt("Judul latihan", data.title)?.trim();
                    if (title && title !== data.title)
                      void run(() => api.patch(data.id, { title }));
                  }}
                  onToggleArchive={() =>
                    void run(() => api.patch(data.id, { archived: !data.archivedAt }))
                  }
                />
                <PracticeDetailContent
                  practice={data}
                  busy={busy}
                  active={Boolean(active)}
                  startDisabled={attempts.isPending || attempts.isError}
                  onRetry={() => void run(() => api.retry(data.id))}
                  onStart={() =>
                    void run(async () => {
                      const attempt = await api.start(data.id);
                      navigate(`/modules/${moduleId}/practice/${data.id}/attempts/${attempt.id}`);
                    })
                  }
                />
                {data.status === "ready" ? (
                  <PracticeAttemptHistory
                    practice={data}
                    attempts={attempts.data}
                    pending={attempts.isPending}
                    failed={attempts.isError}
                    onRetry={() => void attempts.refetch()}
                  />
                ) : null}
                {error ? (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
