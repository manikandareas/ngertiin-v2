import type { Leaderboard } from "@ngertiin/contracts/api";
import { Trophy } from "lucide-react";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";

const numberFormat = new Intl.NumberFormat("id-ID");

type LeaderboardRankingProps = {
  participants: Leaderboard["participants"];
  currentUserId: string;
};

export function LeaderboardRanking({ participants, currentUserId }: LeaderboardRankingProps) {
  return (
    <section aria-labelledby="ranking-title" className="mt-8">
      <h2 id="ranking-title" className="mb-4 font-display text-xl font-bold">
        50 pelajar teratas
      </h2>
      {participants.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Belum ada pelajar di peringkat. Yuk, mulai dengan satu aktivitas belajar!
        </Card>
      ) : (
        <div className="overflow-hidden rounded-card border bg-card">
          <table className="w-full table-fixed text-left text-sm">
            <caption className="sr-only">Peringkat global berdasarkan skor XP aktif</caption>
            <thead className="border-b bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="w-20 p-3 sm:w-28 sm:p-4">
                  Posisi
                </th>
                <th scope="col" className="p-3 sm:p-4">
                  Pelajar
                </th>
                <th scope="col" className="w-28 p-3 text-right sm:p-4">
                  XP
                </th>
              </tr>
            </thead>
            <tbody>
              {participants.map((person) => (
                <tr
                  key={person.userId}
                  className={cn(
                    "border-b last:border-0",
                    person.userId === currentUserId && "bg-accent font-semibold",
                  )}
                >
                  <td className="p-3 sm:p-4">
                    <span className="inline-flex items-center gap-1">
                      {person.rank <= 3 && (
                        <Trophy className="size-4 text-primary" aria-label="Tiga besar" />
                      )}
                      <span>{person.rank}</span>
                    </span>
                  </td>
                  <th scope="row" className="break-words p-3 font-medium sm:p-4">
                    {person.displayName}
                    {person.userId === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">Kamu</span>
                    )}
                  </th>
                  <td className="p-3 text-right tabular-nums sm:p-4">
                    {numberFormat.format(person.score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
