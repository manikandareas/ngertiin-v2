import { useAuth } from "@clerk/react";
import type { PracticeAnswer, PracticeAttempt } from "@ngertiin/contracts/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { practiceApi } from "./practice-api";

export function usePracticeAttempt(practiceId: string | undefined, attemptId: string | undefined) {
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
  const dirtyRef = useRef(false);
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    // Polling can finish with a snapshot older than the latest successful save.
    if (!attempt.data || dirtyRef.current || attempt.data.revision < revisionRef.current) return;
    answersRef.current = attempt.data.answers;
    revisionRef.current = attempt.data.revision;
    setAnswers(attempt.data.answers);
  }, [attempt.data]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const saveAnswer = (id: string, answer: PracticeAnswer) => {
    const next = { ...answersRef.current, [id]: answer };
    answersRef.current = next;
    dirtyRef.current = true;
    setAnswers(next);
    setUnsaved(true);
    if (!saveFailedRef.current) setError(null);
    const task = queueRef.current
      .then(async () => {
        // Stop the queue after a failure, and skip drafts already saved by an earlier task.
        if (!attemptId || saveFailedRef.current || !dirtyRef.current) return;
        const snapshot = answersRef.current;
        // A stale revision must stop here; retrying with a newer revision could overwrite another tab.
        const result: PracticeAttempt = await api.save(attemptId, revisionRef.current, snapshot);
        revisionRef.current = result.revision;
        client.setQueryData<PracticeAttempt>(["practice-attempt", attemptId], (cached) =>
          cached && cached.revision > result.revision ? cached : result,
        );
        if (snapshot === answersRef.current) {
          dirtyRef.current = false;
          setUnsaved(false);
        }
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
  const retryEvaluation = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await api.retryEvaluation(session.id);
      await attempt.refetch();
    } catch {
      setError("Penilaian belum dapat diulang.");
    } finally {
      setBusy(false);
    }
  };
  const markFlashcard = async (id: string, understood: boolean) => {
    await saveAnswer(id, { type: "flashcard", understood });
    if (data && Object.keys(answersRef.current).length === data.items.length) void submit();
  };

  return {
    practice,
    attempt,
    answers,
    unsaved,
    error,
    busy,
    saveAnswer,
    submit,
    retryEvaluation,
    markFlashcard,
    active,
    seconds,
    canAnswer,
  };
}
