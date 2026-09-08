import type { Leaderboard } from "@ngertiin/contracts/api";
import { Card } from "../../components/ui/card";

const numberFormat = new Intl.NumberFormat("id-ID");
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" });

type LeaderboardScoreCardProps = { self: Leaderboard["self"] };

function getScoreMessage(self: Leaderboard["self"]): string {
  if (self.score > 0 && self.expiresAt) {
    return `Dapatkan XP lagi sebelum ${dateFormat.format(new Date(self.expiresAt))} agar skormu tetap terkumpul.`;
  }
  if (self.expiresAt !== null) {
    return "Skor leaderboardmu sudah reset. Dapatkan XP untuk mulai mengumpulkan skor lagi. Total XP belajarmu tetap tersimpan.";
  }
  return "Selesaikan aktivitas belajar untuk mendapatkan XP dan masuk peringkat.";
}

export function LeaderboardScoreCard({ self }: LeaderboardScoreCardProps) {
  return (
    <Card className="gap-3 p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-muted-foreground">Skor leaderboard kamu</h2>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-3xl font-black">{numberFormat.format(self.score)} XP</p>
        <p className="font-semibold">
          {self.rank ? `Peringkat #${numberFormat.format(self.rank)}` : "Belum masuk peringkat"}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{getScoreMessage(self)}</p>
    </Card>
  );
}
