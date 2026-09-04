import type { PublicActivity } from "@ngertiin/contracts/api";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { useCompleteNode, useNode, useStartNode } from "../features/modules/api/use-modules";
import { ApiProblemError } from "../lib/api";

function Lesson({ activity }: { activity: Extract<PublicActivity, { type: "lesson" }> }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      {activity.content.introduction ? (
        <p className="text-lg leading-8 text-slate-700">{activity.content.introduction}</p>
      ) : null}
      <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-700">
        {activity.content.explanation}
      </p>
      <h2 className="mt-7 text-lg font-bold">Poin penting</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
        {activity.content.keyPoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {activity.content.examples?.length ? (
        <>
          <h2 className="mt-7 text-lg font-bold">Contoh</h2>
          <div className="mt-3 space-y-3">
            {activity.content.examples.map((example) => (
              <p className="rounded-2xl bg-slate-50 p-4 leading-7" key={example}>
                {example}
              </p>
            ))}
          </div>
        </>
      ) : null}
      {activity.content.summary ? (
        <div className="mt-7 rounded-2xl bg-teal-50 p-5">
          <h2 className="font-bold text-teal-900">Ringkasan</h2>
          <p className="mt-2 leading-7 text-teal-900">{activity.content.summary}</p>
        </div>
      ) : null}
    </article>
  );
}

function Flashcards({ activity }: { activity: Extract<PublicActivity, { type: "flashcard" }> }) {
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const card = activity.content.cards[index];
  if (!card) return null;
  const move = (next: number) => {
    setIndex(next);
    setShowBack(false);
  };
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Flashcard</span>
        <span>
          {index + 1} / {activity.content.cards.length}
        </span>
      </div>
      <button
        className="mt-5 grid min-h-64 w-full place-items-center rounded-2xl bg-slate-950 p-8 text-center text-xl font-semibold text-white"
        onClick={() => setShowBack((value) => !value)}
        type="button"
      >
        <span>{showBack ? card.back : card.front}</span>
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">Klik kartu untuk membalik</p>
      <div className="mt-5 flex justify-between gap-3">
        <Button disabled={index === 0} onClick={() => move(index - 1)} variant="outline">
          Sebelumnya
        </Button>
        {showBack ? (
          <Button onClick={() => setShowBack(false)} variant="outline">
            <RotateCcw className="mr-2 size-4" />
            Balik lagi
          </Button>
        ) : null}
        <Button
          disabled={index === activity.content.cards.length - 1}
          onClick={() => move(index + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </article>
  );
}

function Assessment({
  activity,
}: {
  activity: Exclude<PublicActivity, { type: "lesson" | "flashcard" }>;
}) {
  const prompt =
    activity.type === "multiple_choice"
      ? activity.content.question
      : activity.type === "true_false"
        ? activity.content.statement
        : activity.content.prompt;
  return (
    <article className="rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Assessment</p>
      <h2 className="mt-3 text-xl font-bold">{prompt}</h2>
      {activity.type === "multiple_choice" ? (
        <ul className="mt-5 space-y-2">
          {activity.content.options.map((option) => (
            <li className="rounded-xl border border-slate-200 p-3" key={option}>
              {option}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Assessment belum tersedia. Node ini akan dapat diselesaikan pada milestone berikutnya.
      </p>
    </article>
  );
}

export default function ModuleNodePage() {
  const { moduleId = "", nodeId = "" } = useParams();
  const navigate = useNavigate();
  const nodeQuery = useNode(moduleId, nodeId);
  const start = useStartNode(moduleId, nodeId);
  const complete = useCompleteNode(moduleId, nodeId);
  const startedNodeId = useRef<string | null>(null);

  useEffect(() => {
    if (nodeQuery.data?.node.progress.status !== "available" || startedNodeId.current === nodeId)
      return;
    startedNodeId.current = nodeId;
    start.mutate();
  }, [nodeId, nodeQuery.data?.node.progress.status, start.mutate]);

  if (nodeQuery.isPending)
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Memuat node…</p>
      </AppShell>
    );
  if (nodeQuery.isError || !nodeQuery.data)
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8">
          <h1 className="text-2xl font-bold">Node belum dapat dibuka</h1>
          <p className="mt-3 text-slate-600">Node mungkin masih terkunci atau tidak tersedia.</p>
        </div>
      </AppShell>
    );

  const data = nodeQuery.data;
  const completed = data.node.progress.status === "completed";
  const canComplete =
    data.activities.length > 0 &&
    data.activities.every(
      (activity) => activity.type === "lesson" || activity.type === "flashcard",
    );
  const mutationError = start.error ?? complete.error;
  const errorMessage =
    mutationError instanceof ApiProblemError
      ? mutationError.problem.detail
      : mutationError
        ? "Progress belum dapat disimpan. Coba lagi."
        : null;

  async function handleComplete() {
    try {
      const result = await complete.mutateAsync();
      if (
        result.nextAction.type === "start_core_node" ||
        result.nextAction.type === "resume_core_node"
      ) {
        navigate(`/modules/${moduleId}/nodes/${result.nextAction.nodeId}`);
      } else {
        navigate(`/modules/${moduleId}/journey`);
      }
    } catch {
      /* Mutation state renders the safe error. */
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <Link
          className="inline-flex items-center text-sm font-semibold text-slate-600"
          to={`/modules/${moduleId}/journey`}
        >
          <ArrowLeft className="mr-2 size-4" />
          Kembali ke Journey
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          {completed ? "Mode review" : data.node.type}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{data.node.title}</h1>
        {data.node.description ? (
          <p className="mt-4 text-lg leading-8 text-slate-600">{data.node.description}</p>
        ) : null}
        <div className="mt-8 space-y-6">
          {data.activities.map((activity) =>
            activity.type === "lesson" ? (
              <Lesson activity={activity} key={activity.id} />
            ) : activity.type === "flashcard" ? (
              <Flashcards activity={activity} key={activity.id} />
            ) : (
              <Assessment activity={activity} key={activity.id} />
            ),
          )}
        </div>
        {errorMessage ? (
          <p className="mt-6 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {completed ? (
          <p className="mt-8 rounded-2xl bg-teal-50 p-4 font-medium text-teal-900">
            Node ini sudah selesai. Kamu sedang membukanya kembali untuk review.
          </p>
        ) : canComplete ? (
          <Button
            className="mt-8"
            disabled={complete.isPending || start.isPending}
            onClick={handleComplete}
          >
            {complete.isPending ? "Menyimpan…" : "Selesaikan node"}
            <ArrowRight className="ml-2 size-4" />
          </Button>
        ) : null}
      </div>
    </AppShell>
  );
}
