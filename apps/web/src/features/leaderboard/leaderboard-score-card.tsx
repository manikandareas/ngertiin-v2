import type { Leaderboard } from "@ngertiin/contracts/api";
import { Sprout } from "lucide-react";

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
    <section
      aria-labelledby="self-score-title"
      className="mt-6 rounded-card border-2 px-3 py-6 sm:px-5"
    >
      <div className="flex items-start gap-3">
        <Sprout aria-hidden="true" className="mt-1 size-7 shrink-0 text-success" />
        <div className="min-w-0 flex-1 space-y-3">
          <h2 id="self-score-title" className="text-sm font-semibold text-muted-foreground">
            Skor leaderboard kamu
          </h2>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-display text-2xl font-black">{numberFormat.format(self.score)} XP</p>
            <p className="font-semibold">
              {self.rank ? `Peringkat #${numberFormat.format(self.rank)}` : "Belum masuk peringkat"}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{getScoreMessage(self)}</p>
        </div>
      </div>
    </section>
  );
}
