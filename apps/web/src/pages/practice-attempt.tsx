import { useAuth } from "@clerk/react";
import type { PracticeAnswer, PracticeAttempt } from "@ngertiin/contracts/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Flashcards } from "../features/modules/components/flashcard-activity";
import { PracticeAttemptResult } from "../features/practice/components/practice-attempt-result";
import { PracticeQuestion } from "../features/practice/components/practice-question";
import { practiceApi } from "../features/practice/practice-api";

export default function PracticeAttemptPage() {
  const { moduleId, practiceId, attemptId } = useParams();
  const { getToken } = useAuth();
  const client = useQueryClient();
  const api = practiceApi(getToken);
  const practice = useQuery({
    queryKey: ["practice", practiceId],
    queryFn: () => api.detail(practiceId ?? ""),
    enabled: Boolean(practiceId),
  });
  const attempt = useQuery({
    queryKey: ["practice-attempt", attemptId],
    queryFn: () => api.attempt(attemptId ?? ""),
    enabled: Boolean(attemptId),
    refetchInterval: (query) =>
      ["active", "evaluating"].includes(query.state.data?.status ?? "") ? 3000 : false,
  });
  const [answers, setAnswers] = useState<Record<string, PracticeAnswer>>({});
  const answersRef = useRef<Record<string, PracticeAnswer>>({});
  const revisionRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const saveFailedRef = useRef(false);
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!attempt.data || unsaved) return;
    answersRef.current = attempt.data.answers;
    revisionRef.current = attempt.data.revision;
    setAnswers(attempt.data.answers);
  }, [attempt.data, unsaved]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const saveAnswer = (id: string, answer: PracticeAnswer) => {
    const next = { ...answersRef.current, [id]: answer };
    answersRef.current = next;
    setAnswers(next);
    setUnsaved(true);
    saveFailedRef.current = false;
    setError(null);
    const task = queueRef.current
      .then(async () => {
        if (!attemptId) return;
        // A stale revision must stop here; retrying with a newer revision could overwrite another tab.
        const result: PracticeAttempt = await api.save(
          attemptId,
          revisionRef.current,
          answersRef.current,
        );
        revisionRef.current = result.revision;
        if (JSON.stringify(result.answers) === JSON.stringify(answersRef.current))
          setUnsaved(false);
      })
      .catch(() => {
        saveFailedRef.current = true;
        setError("Jawaban belum tersimpan. Muat ulang sesi sebelum melanjutkan.");
      });
    queueRef.current = task;
    return task;
  };
  const submit = async () => {
    if (!attemptId) return;
    setBusy(true);
    setError(null);
    try {
      await queueRef.current;
      if (saveFailedRef.current) throw new Error("Jawaban belum tersimpan.");
      await api.submit(attemptId);
      await client.invalidateQueries({ queryKey: ["practice-attempt", attemptId] });
      await client.invalidateQueries({ queryKey: ["practice-attempts", practiceId] });
    } catch {
      setError("Latihan belum dapat dikirim. Periksa jawaban tersimpan lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  };
  const data = practice.data;
  const session = attempt.data;
  const active = session?.status === "active";
  const seconds = session?.deadlineAt
    ? Math.max(0, Math.ceil((new Date(session.deadlineAt).getTime() - now) / 1000))
    : null;
  const canAnswer = active && (seconds === null || seconds > 0);
  const item = data?.items[position];
  const currentAnswer = item ? answers[item.id] : undefined;
  const answered = data?.items.filter((entry) => answers[entry.id] !== undefined).length ?? 0;
  const flashcards =
    data?.kind === "flashcard"
      ? data.items.flatMap((entry) =>
          entry.content.type === "flashcard"
            ? [{ front: entry.content.front, back: entry.content.back, conceptKey: entry.id }]
            : [],
        )
      : [];
  return (
    <AppShell sidebar={active && data?.kind === "exam" ? <span className="hidden" /> : undefined}>
      <div className="mx-auto max-w-3xl pb-16">
        <Link
          to={`/modules/${moduleId}/practice/${practiceId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Kembali ke latihan
        </Link>
        {practice.isPending || attempt.isPending ? (
          <p className="mt-7 text-sm text-muted-foreground">Memuat sesi…</p>
        ) : null}
        {practice.isError || attempt.isError ? (
          <p role="alert" className="mt-7 text-sm text-destructive">
            Sesi belum dapat dimuat.
          </p>
        ) : null}
        {data && session ? (
          <>
            <header className="mt-7 flex flex-wrap items-start justify-between gap-3 border-b pb-5">
              <div>
                <p className="text-sm text-muted-foreground">
                  {data.kind === "flashcard" ? "Flashcard" : data.kind === "quiz" ? "Kuis" : "Exam"}{" "}
                  · {answered}/{data.items.length} terjawab
                </p>
                <h1 className="mt-1 text-2xl font-semibold">{data.title}</h1>
              </div>
              {seconds !== null && active ? (
                <p
                  role="timer"
                  className="rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums"
                >
                  {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                </p>
              ) : null}
            </header>
            {active && seconds === 0 ? (
              <p role="status" className="mt-5 text-sm text-muted-foreground">
                Waktu habis. Jawaban sedang dikirim oleh server.
              </p>
            ) : null}
            {canAnswer && data.kind === "flashcard" ? (
              <div className="mt-8">
                <Flashcards
                  activity={{
                    id: data.id,
                    type: "flashcard",
                    position: 1,
                    content: { cards: flashcards },
                  }}
                  marked={Object.fromEntries(
                    data.items
                      .map((entry, index) => {
                        const answer = answers[entry.id];
                        return [
                          index,
                          answer?.type === "flashcard" ? answer.understood : undefined,
                        ];
                      })
                      .filter((entry) => entry[1] !== undefined),
                  )}
                  onMark={(index, understood) => {
                    const selected = data.items[index];
                    if (!selected) return;
                    void saveAnswer(selected.id, { type: "flashcard", understood }).then(() => {
                      if (Object.keys(answersRef.current).length === data.items.length)
                        void submit();
                    });
                  }}
                />
              </div>
            ) : null}
            {canAnswer && data.kind !== "flashcard" && item ? (
              <div className="mt-8">
                <nav aria-label="Nomor soal" className="mb-6 flex flex-wrap gap-2">
                  {data.items.map((entry, index) => (
                    <Button
                      key={entry.id}
                      size="sm"
                      variant={
                        index === position ? "default" : answers[entry.id] ? "secondary" : "outline"
                      }
                      onClick={() => setPosition(index)}
                    >
                      {index + 1}
                    </Button>
                  ))}
                </nav>
                <PracticeQuestion
                  item={item}
                  position={position}
                  total={data.items.length}
                  currentAnswer={currentAnswer}
                  onAnswer={(answer) => void saveAnswer(item.id, answer)}
                />
                <div className="mt-5 flex justify-between">
                  <Button
                    variant="outline"
                    disabled={position === 0}
                    onClick={() => setPosition((old) => old - 1)}
                  >
                    <ArrowLeft className="size-4" />
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    disabled={position >= data.items.length - 1}
                    onClick={() => setPosition((old) => old + 1)}
                  >
                    Berikutnya
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
                <div className="mt-7 flex items-center justify-between border-t pt-5">
                  <p role="status" className="text-xs text-muted-foreground">
                    {unsaved ? "Belum tersimpan" : "Jawaban tersimpan"}
                  </p>
                  <Button
                    disabled={busy || (data.kind === "quiz" && answered < data.items.length)}
                    onClick={() => void submit()}
                  >
                    Kirim jawaban
                  </Button>
                </div>
              </div>
            ) : null}
            {session.status === "evaluating" ? (
              <div role="status" className="mt-8 rounded-2xl border bg-card p-6">
                <p className="font-medium">Jawaban sedang dinilai</p>
                <p className="mt-1 text-sm text-muted-foreground">Hasil akan muncul otomatis.</p>
              </div>
            ) : null}
            {session.status === "evaluation_failed" ? (
              <div className="mt-8 rounded-2xl border bg-card p-6">
                <p className="font-medium">Penilaian belum berhasil</p>
                <p className="mt-1 text-sm text-muted-foreground">Jawabanmu tetap tersimpan.</p>
                <Button
                  className="mt-4"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void api
                      .retryEvaluation(session.id)
                      .then(() => void attempt.refetch())
                      .catch(() => setError("Penilaian belum dapat diulang."))
                      .finally(() => setBusy(false));
                  }}
                >
                  Coba nilai lagi
                </Button>
              </div>
            ) : null}
            {session.status === "completed" ? (
              <PracticeAttemptResult data={data} session={session} />
            ) : null}
            {error ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
