import type { Leaderboard } from "@ngertiin/contracts/api";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { UserAvatar } from "../../components/user-avatar";
import { cn } from "../../lib/utils";

const numberFormat = new Intl.NumberFormat("id-ID");

type LeaderboardRankingProps = {
  participants: Leaderboard["participants"];
  currentUserId: string;
};

export function LeaderboardRanking({ participants, currentUserId }: LeaderboardRankingProps) {
  const selfRowRef = useRef<HTMLTableRowElement>(null);
  const hasSelf = participants.some((person) => person.userId === currentUserId);

  function showMyPosition() {
    const target = selfRowRef.current;
    target?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    target?.focus({ preventScroll: true });
  }

  return (
    <section aria-labelledby="ranking-title" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 id="ranking-title" className="font-display text-xl font-bold">
          Papan peringkat
        </h2>
        {hasSelf && (
          <Button type="button" variant="link" size="sm" onClick={showMyPosition} className="px-0">
            Lihat posisiku <ArrowUpRight aria-hidden="true" />
          </Button>
        )}
      </div>
      {participants.length === 0 ? (
        <p className="rounded-card border-2 border-dashed p-6 text-sm leading-relaxed text-muted-foreground">
          Belum ada pelajar di peringkat. Yuk, mulai dengan satu aktivitas belajar!
        </p>
      ) : (
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">
            Hingga 50 pelajar teratas berdasarkan skor XP aktif, termasuk peserta di podium.
          </caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-14 px-2 pb-4 font-semibold sm:w-16">
                Posisi
              </th>
              <th scope="col" className="px-2 pb-4 font-semibold">
                Pelajar
              </th>
              <th scope="col" className="w-24 px-2 pb-4 text-right font-semibold sm:w-28">
                Skor XP
              </th>
            </tr>
          </thead>
          <tbody>
            {participants.map((person) => (
              <tr
                key={person.userId}
                ref={person.userId === currentUserId ? selfRowRef : undefined}
                tabIndex={person.userId === currentUserId ? -1 : undefined}
                className={cn(
                  "scroll-m-8 border-b focus:outline-2 focus:-outline-offset-2 focus:outline-ring",
                  person.userId === currentUserId && "bg-accent",
                )}
              >
                <td className="px-2 py-5 tabular-nums text-muted-foreground">{person.rank}</td>
                <th scope="row" className="px-2 py-5 font-semibold">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-muted font-display font-extrabold text-muted-foreground sm:inline-flex"
                    >
                      <UserAvatar
                        avatarUrl={person.avatarUrl}
                        name={person.displayName}
                        className="size-full rounded-xl"
                      />
                    </span>
                    <span className="min-w-0 break-words">
                      {person.displayName}
                      {person.userId === currentUserId && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Kamu
                        </Badge>
                      )}
                    </span>
                  </div>
                </th>
                <td className="px-2 py-5 text-right font-bold tabular-nums">
                  {numberFormat.format(person.score)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Menampilkan hingga 50 pelajar teratas. Setiap langkah belajar layak dirayakan, di posisi
        berapa pun kamu berada.
      </p>
    </section>
  );
}
