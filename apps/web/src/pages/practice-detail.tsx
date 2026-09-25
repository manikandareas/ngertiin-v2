import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { practiceApi } from "../features/practice/practice-api";

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
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl pb-16">
        <Link
          to={`/modules/${moduleId}/practice`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Latihan
        </Link>
        {practice.isPending ? (
          <p className="mt-8 text-sm text-muted-foreground">Memuat latihan…</p>
        ) : null}
        {practice.isError ? (
          <p role="alert" className="mt-8 text-sm text-destructive">
            Latihan belum dapat dimuat.
          </p>
        ) : null}
        {data ? (
          <>
            <header className="mt-7 border-b pb-7">
              <p className="text-sm text-muted-foreground">
                {data.kind === "flashcard" ? "Flashcard" : data.kind === "quiz" ? "Kuis" : "Exam"} ·{" "}
                {data.itemCount} {data.kind === "flashcard" ? "kartu" : "soal"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{data.configuration.focus}</p>
            </header>
            {data.status === "generating" ? (
              <div role="status" className="mt-7 rounded-2xl border bg-card p-6">
                <p className="font-medium">Latihan sedang disusun</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Progres {data.progress}% · halaman ini akan memperbarui status otomatis.
                </p>
              </div>
            ) : null}
            {data.status === "failed" ? (
              <div className="mt-7 rounded-2xl border bg-card p-6">
                <p className="font-medium">Pembuatan belum berhasil</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.failure ?? "Coba lagi dengan pengaturan yang sama."}
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(() => api.retry(data.id))}
                >
                  <RotateCcw className="size-4" />
                  Coba lagi
                </Button>
              </div>
            ) : null}
            {data.status === "ready" ? (
              <div className="mt-7 space-y-7">
                <div className="rounded-2xl border bg-card p-6">
                  <p className="text-sm text-muted-foreground">
                    {data.kind === "exam"
                      ? `Waktu ${data.configuration.durationMinutes} menit. Timer berjalan sejak exam dimulai.`
                      : data.kind === "flashcard"
                        ? "Balik kartu dan tandai pemahamanmu."
                        : "Jawaban tersimpan otomatis selama latihan."}
                  </p>
                  <Button
                    className="mt-4"
                    disabled={busy || Boolean(data.archivedAt)}
                    onClick={() =>
                      void run(async () => {
                        const attempt = await api.start(data.id);
                        navigate(`/modules/${moduleId}/practice/${data.id}/attempts/${attempt.id}`);
                      })
                    }
                  >
                    {attempts.data?.some((attempt) => attempt.status === "active")
                      ? "Lanjutkan"
                      : data.kind === "exam"
                        ? "Mulai exam"
                        : "Mulai latihan"}
                  </Button>
                  {data.archivedAt ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Latihan ini diarsipkan. Riwayat tetap tersedia.
                    </p>
                  ) : null}
                </div>
                <section>
                  <h2 className="text-lg font-semibold">Riwayat</h2>
                  <div className="mt-3 grid gap-2">
                    {attempts.data?.map((attempt) => (
                      <Link
                        key={attempt.id}
                        to={`/modules/${moduleId}/practice/${data.id}/attempts/${attempt.id}`}
                        className="flex justify-between rounded-xl border px-4 py-3 text-sm hover:bg-muted/40"
                      >
                        <span>
                          {new Date(attempt.startedAt).toLocaleDateString("id-ID")} ·{" "}
                          {attempt.status === "active"
                            ? "Belum selesai"
                            : attempt.status === "completed"
                              ? "Selesai"
                              : "Sedang dinilai"}
                        </span>
                        <span>{attempt.score === null ? "—" : `${attempt.score}/100`}</span>
                      </Link>
                    ))}
                    {attempts.data?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada pengerjaan.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-2 border-t pt-5">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  const title = window.prompt("Judul latihan", data.title)?.trim();
                  if (title && title !== data.title) void run(() => api.patch(data.id, { title }));
                }}
              >
                Ganti judul
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void run(() => api.patch(data.id, { archived: !data.archivedAt }))}
              >
                <Archive className="size-4" />
                {data.archivedAt ? "Buka arsip" : "Arsipkan"}
              </Button>
            </div>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
