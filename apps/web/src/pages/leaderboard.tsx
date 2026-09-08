import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { LeaderboardRanking } from "../features/leaderboard/leaderboard-ranking";
import { LeaderboardScoreCard } from "../features/leaderboard/leaderboard-score-card";
import { useLeaderboard } from "../features/leaderboard/use-leaderboard";

export default function LeaderboardPage() {
  const query = useLeaderboard();
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-black">Leaderboard</h1>
        <p className="mb-8 mt-3 text-sm leading-relaxed text-muted-foreground">
          Dapatkan XP sebelum 7 hari berlalu agar skor leaderboard tetap terkumpul. Total XP
          belajarmu tetap tersimpan.
        </p>
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
          <>
            <LeaderboardScoreCard self={query.data.self} />
            <LeaderboardRanking
              participants={query.data.participants}
              currentUserId={query.data.self.userId}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
