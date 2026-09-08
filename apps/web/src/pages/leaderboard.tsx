import { Globe } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { LeaderboardPodium } from "../features/leaderboard/leaderboard-podium";
import { LeaderboardRanking } from "../features/leaderboard/leaderboard-ranking";
import { LeaderboardScoreCard } from "../features/leaderboard/leaderboard-score-card";
import { useLeaderboard } from "../features/leaderboard/use-leaderboard";

export default function LeaderboardPage() {
  const query = useLeaderboard();
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-black">Leaderboard</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sedikit kompetisi, banyak semangat belajar.
            </p>
          </div>
          <Badge variant="secondary" className="gap-2">
            <Globe aria-hidden="true" />
            Peringkat global
          </Badge>
        </header>
        {query.isPending && (
          <p role="status" className="py-12 text-center text-muted-foreground">
            Memuat peringkat…
          </p>
        )}
        {query.isError && (
          <div role="alert" className="mb-6 space-y-3 rounded-card border p-5">
            <p>Peringkat belum dapat diperbarui.</p>
            <Button
              variant="outline"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Coba lagi
            </Button>
          </div>
        )}
        {query.data && (
          <div className="grid grid-cols-1 gap-10">
            <div className="min-w-0">
              <LeaderboardPodium
                participants={query.data.participants}
                currentUserId={query.data.self.userId}
              />
              <LeaderboardScoreCard self={query.data.self} />
            </div>
            <LeaderboardRanking
              participants={query.data.participants}
              currentUserId={query.data.self.userId}
            />
          </div>
        )}
        <details className="mt-10 border-t pt-5 text-sm text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            Bagaimana skor leaderboard dihitung?
          </summary>
          <p className="mt-3 max-w-2xl leading-relaxed">
            Dapatkan XP lagi sebelum 7 hari sejak XP terakhirmu agar skor leaderboard tetap
            terkumpul. Setelah tidak mendapat XP selama 7 hari, skor leaderboard akan reset. Total
            XP belajarmu tetap tersimpan.
          </p>
        </details>
      </div>
    </AppShell>
  );
}
