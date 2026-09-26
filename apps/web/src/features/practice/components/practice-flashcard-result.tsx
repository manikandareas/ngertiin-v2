import { useAuth } from "@clerk/react";
import type { PracticeAttempt, PracticeDetail } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlashcardDeck } from "../../../components/flashcards/flashcard-deck";
import { Button } from "../../../components/ui/button";
import { practiceApi } from "../practice-api";

type Props = { data: PracticeDetail; session: PracticeAttempt };

export function PracticeFlashcardResult({ data, session }: Props) {
  const [reviewing, setReviewing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const cards = data.items.flatMap((item, index) =>
    item.content.type === "flashcard"
      ? [
          {
            id: item.id,
            front: item.content.front,
            back: item.content.back,
            decorationIndex: index,
          },
        ]
      : [],
  );
  const understood = cards.filter((card) => {
    const answer = session.answers[card.id];
    return answer?.type === "flashcard" && answer.understood;
  });
  const repeat = cards.filter((card) => {
    const answer = session.answers[card.id];
    return answer?.type === "flashcard" && !answer.understood;
  });
  const restart = async () => {
    if (starting) return;
    setStarting(true);
    setError(false);
    try {
      const next = await practiceApi(getToken).start(data.id);
      await client.invalidateQueries({ queryKey: ["practice-attempts", data.id] });
      navigate(`/modules/${data.moduleId}/practice/${data.id}/attempts/${next.id}`);
    } catch {
      setError(true);
    } finally {
      setStarting(false);
    }
  };

  if (reviewing)
    return (
      <section>
        <Button variant="ghost" className="mb-5" onClick={() => setReviewing(false)}>
          <ArrowLeft className="size-4" /> Kembali ke hasil
        </Button>
        <h2 className="font-display text-2xl font-bold">Ulangi yang masih sulit.</h2>
        <p className="mt-2 mb-4 text-sm text-muted-foreground">
          Latihan ulang ini tidak mengubah hasil sesi atau menambah XP.
        </p>
        <FlashcardDeck cards={repeat} />
      </section>
    );

  return (
    <section>
      <header className="flex flex-col gap-5 py-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex size-20 shrink-0 -rotate-6 items-center justify-center rounded-3xl bg-success-subtle text-success-foreground">
          <Check className="size-10" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Refleksi belajar
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
            Satu sesi, makin mengerti.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Kamu sudah meninjau {cards.length} kartu.{" "}
            {repeat.length
              ? "Ada beberapa konsep yang bisa kamu pelajari lagi."
              : "Semua kartu sudah kamu tandai paham."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">+{session.xpAwarded} XP</p>
        </div>
      </header>
      <div className="my-7 rounded-2xl bg-muted p-5">
        <h3 className="font-bold">
          {repeat.length ? "Mulai lagi dari yang masih sulit." : "Pertahankan pemahamanmu."}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Coba jelaskan jawabannya tanpa melihat kartu. Ini refleksi pribadi, bukan nilai ujian.
        </p>
      </div>
      <div className="grid gap-7 sm:grid-cols-2">
        {[
          { title: "Sudah paham", items: understood, icon: Check },
          { title: "Perlu diulang", items: repeat, icon: RotateCcw },
        ].map(({ title, items, icon: Icon }) => (
          <section key={title}>
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <Icon className="size-4" /> {title}{" "}
              <span className="font-normal text-muted-foreground">· {items.length}</span>
            </h3>
            <div className="border-t">
              {items.length ? (
                items.map((card) => (
                  <details key={card.id} className="border-b py-4">
                    <summary className="cursor-pointer text-sm leading-relaxed font-semibold wrap-anywhere">
                      {card.front}
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed wrap-anywhere text-muted-foreground">
                      {card.back}
                    </p>
                  </details>
                ))
              ) : (
                <p className="py-4 text-sm text-muted-foreground">Tidak ada kartu di sini.</p>
              )}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        {repeat.length ? (
          <Button onClick={() => setReviewing(true)}>
            <RotateCcw className="size-4" /> Ulangi {repeat.length} kartu
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={starting || Boolean(data.archivedAt)}
          onClick={() => void restart()}
        >
          {starting ? "Memulai…" : "Belajar dari awal"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Sesi belum dapat dimulai. Coba lagi.
        </p>
      ) : null}
    </section>
  );
}
