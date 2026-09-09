import type { Leaderboard } from "@ngertiin/contracts/api";
import { Crown } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { UserAvatar } from "../../components/user-avatar";
import { cn } from "../../lib/utils";
import { LeaderboardBookStack } from "./leaderboard-book-stack";

const numberFormat = new Intl.NumberFormat("id-ID");
type LeaderboardPodiumProps = {
  participants: Leaderboard["participants"];
  currentUserId: string;
};

export function LeaderboardPodium({ participants, currentUserId }: LeaderboardPodiumProps) {
  const winners = ([2, 1, 3] as const).map((position) => ({
    position,
    person: participants[position - 1],
  }));
  return (
    <section
      aria-labelledby="podium-title"
      className="relative isolate overflow-hidden bg-card px-3 pb-6 pt-8 sm:px-5"
    >
      <h2
        id="podium-title"
        className="mx-auto max-w-sm text-center font-display text-xl font-black text-balance"
      >
        Buku ditumpuk, ilmu dipupuk.
      </h2>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Kenalan dengan tiga pelajar teratas kita.
      </p>

      <div className="relative mx-auto mt-10 grid max-w-md grid-cols-3 items-end gap-2 sm:gap-3">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-3 rounded-full bg-border"
        />
        {winners.map(({ position, person }) => (
          <div key={position} className="min-w-0 rounded-card text-center">
            {person?.rank === 1 && (
              <Crown
                aria-hidden="true"
                className="mx-auto mb-3 size-7 -rotate-12 text-adaptive-foreground"
              />
            )}
            <div
              aria-hidden="true"
              className={cn(
                "mx-auto mb-3 overflow-hidden grid size-14 place-items-center rounded-card border-4 border-background font-display text-xl font-black sm:size-16",
                person?.rank === 1
                  ? "size-16 -rotate-6 bg-adaptive text-adaptive-ink sm:size-20 sm:text-2xl"
                  : "rotate-6 bg-primary text-night-ink",
                !person && "border-dashed bg-muted text-muted-foreground",
              )}
            >
              {person ? (
                <UserAvatar
                  avatarUrl={person.avatarUrl}
                  name={person.displayName}
                  className="size-full"
                />
              ) : (
                "?"
              )}
            </div>
            <p className="sr-only">{person ? `Peringkat ${person.rank}` : "Podium belum terisi"}</p>
            <p className="min-h-10 break-words text-xs font-bold sm:text-sm">
              {person?.displayName ?? "Siapa berikutnya?"}
              {person?.userId === currentUserId && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  Kamu
                </Badge>
              )}
            </p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {person ? `${numberFormat.format(person.score)} XP` : "Tempatmu di sini?"}
            </p>
            <LeaderboardBookStack position={position} rank={person?.rank ?? null} />
          </div>
        ))}
      </div>
    </section>
  );
}
