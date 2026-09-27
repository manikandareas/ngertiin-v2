import type {
  AssessmentAnswer,
  PracticeAnswer,
  PracticeDetail,
  PublicActivity,
} from "@ngertiin/contracts/api";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Assessment } from "../modules/components/assessment-activity";
import { PracticeQuizQuestion } from "../practice/components/practice-quiz-question";
import { PracticeQuizResultQuestion } from "../practice/components/practice-quiz-result-question";

type Kind = "multiple_choice" | "true_false" | "short_answer";
type PreviewState = "interactive" | "readonly" | "correct" | "incorrect";
const kinds: { value: Kind; label: string }[] = [
  { value: "multiple_choice", label: "Pilihan ganda" },
  { value: "true_false", label: "Benar / salah" },
  { value: "short_answer", label: "Jawaban singkat" },
];
const states: { value: PreviewState; label: string }[] = [
  { value: "interactive", label: "Bisa dijawab" },
  { value: "readonly", label: "Read-only" },
  { value: "correct", label: "Hasil benar" },
  { value: "incorrect", label: "Hasil salah" },
];
const options = ["Mars", "Bumi", "Venus"];
const questions = {
  multiple_choice: "Planet mana yang dikenal sebagai planet biru?",
  true_false: "Bumi mengelilingi Matahari.",
  short_answer: "Mengapa Bumi disebut planet biru?",
};
const nodeId = "00000000-0000-4000-8000-000000000001";
const practiceId = "00000000-0000-4000-8000-000000000002";

function QuizPreview({ kind, state }: { kind: Kind; state: PreviewState }) {
  const correct = state !== "incorrect";
  const initial: AssessmentAnswer =
    kind === "multiple_choice"
      ? { optionIndex: correct ? 1 : 0 }
      : kind === "true_false"
        ? { value: correct }
        : {
            text: correct
              ? "Sebagian besar permukaan Bumi tertutup air."
              : "Karena seluruh daratannya berwarna biru.",
          };
  const [nodeAnswer, setNodeAnswer] = useState<AssessmentAnswer | undefined>(initial);
  const [practiceAnswer, setPracticeAnswer] = useState<PracticeAnswer | undefined>({
    type: kind,
    ...initial,
  } as PracticeAnswer);
  const reviewing = state === "correct" || state === "incorrect";
  const locked = state !== "interactive";
  const explanation =
    kind === "true_false"
      ? "Bumi berevolusi mengelilingi Matahari."
      : "Bumi tampak biru karena sebagian besar permukaannya tertutup air.";
  const activity: Exclude<PublicActivity, { type: "lesson" | "flashcard" }> =
    kind === "multiple_choice"
      ? { id: nodeId, position: 1, type: kind, content: { question: questions[kind], options } }
      : kind === "true_false"
        ? { id: nodeId, position: 1, type: kind, content: { statement: questions[kind] } }
        : { id: nodeId, position: 1, type: kind, content: { prompt: questions[kind] } };
  const item: PracticeDetail["items"][number] = {
    id: practiceId,
    position: 1,
    content:
      kind === "multiple_choice"
        ? { type: kind, question: questions[kind], options }
        : { type: kind, question: questions[kind] },
  };
  return (
    <div className="space-y-6">
      {!locked && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setNodeAnswer(undefined);
            setPracticeAnswer(undefined);
          }}
        >
          Kosongkan jawaban
        </Button>
      )}
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <h3 className="text-sm font-bold text-muted-foreground">Node activity</h3>
          <Assessment
            activity={activity}
            answer={nodeAnswer}
            onAnswer={setNodeAnswer}
            readOnly={locked}
            result={
              reviewing
                ? {
                    activityId: nodeId,
                    answer: initial,
                    correct,
                    score: correct ? 1 : 0,
                    maxScore: 1,
                    explanation,
                  }
                : undefined
            }
          />
        </div>
        <div className="min-w-0 space-y-5">
          <h3 className="text-sm font-bold text-muted-foreground">Practice quiz</h3>
          {reviewing ? (
            <PracticeQuizResultQuestion
              item={item}
              answer={practiceAnswer}
              result={{ itemId: practiceId, score: correct ? 1 : 0, explanation }}
            />
          ) : (
            <PracticeQuizQuestion
              item={item}
              answer={practiceAnswer}
              onAnswer={(_id, answer) => setPracticeAnswer(answer)}
              busy={locked}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function QuizExamples() {
  const [kind, setKind] = useState<Kind>("multiple_choice");
  const [state, setState] = useState<PreviewState>("interactive");
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Komponen yang sama dengan aktivitas modul dan practice. Coba memilih jawaban atau ganti
        state untuk memeriksa hasil benar, salah, dan read-only. Data contoh ini tidak disimpan.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          value={kind}
          onValueChange={(value) => {
            const next = kinds.find((entry) => entry.value === value);
            if (next) setKind(next.value);
          }}
        >
          <TabsList aria-label="Jenis quiz" className="flex flex-wrap">
            {kinds.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select
          value={state}
          onValueChange={(value) => {
            const next = states.find((entry) => entry.value === value);
            if (next) setState(next.value);
          }}
        >
          <SelectTrigger aria-label="State quiz">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {states.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <QuizPreview key={`${kind}-${state}`} kind={kind} state={state} />
    </div>
  );
}
