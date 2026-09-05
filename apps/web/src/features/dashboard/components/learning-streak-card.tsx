import type { Dashboard } from "@ngertiin/contracts/api";
import { Battery, Zap } from "lucide-react";
import { Card } from "../../../components/ui/card";

export function LearningStreakCard({ stats }: { stats: Dashboard["stats"] }) {
  // The API provides one confirmed date, not a daily activity history.
  const streakAnchor = stats.lastLearningDate
    ? new Date(`${stats.lastLearningDate}T00:00:00Z`)
    : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const streakDays = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(streakAnchor);
    date.setUTCDate(date.getUTCDate() + index);
    return {
      date,
      label: new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(date),
      fullLabel: new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" }).format(
        date,
      ),
      recorded: index === 0 && Boolean(stats.lastLearningDate),
    };
  });
  return (
    <Card
      role="region"
      aria-label="Streak belajar"
      className="gap-5 bg-background px-5 py-6 sm:px-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-6xl font-extrabold leading-none tracking-tight">
            {stats.currentStreak}
            <span className="sr-only"> hari beruntun</span>
          </span>
          <Zap
            aria-hidden="true"
            className={`size-9 ${stats.currentStreak > 0 ? "text-primary" : "text-border"}`}
            strokeWidth={1.8}
          />
        </div>
        <div aria-hidden="true" className="flex gap-1 text-border">
          <Battery className="size-5 -rotate-90" />
          <Battery className="size-5 -rotate-90" />
        </div>
      </div>
      <p className="text-sm leading-relaxed">
        {stats.currentStreak > 0 ? (
          <>
            Terus <strong>belajar setiap hari</strong> untuk menjaga streak.
          </>
        ) : (
          <>
            Selesaikan <strong>sesi belajar</strong> untuk memulai streak.
          </>
        )}
      </p>
      <ol
        aria-label={
          stats.lastLearningDate
            ? "Tanggal belajar terakhir dan empat hari berikutnya"
            : "Hari ini dan empat hari berikutnya"
        }
        className="grid grid-cols-5 gap-2"
      >
        {streakDays.map(({ date, label, fullLabel, recorded }, index) => (
          <li
            key={date.toISOString()}
            className="min-w-0 text-center"
            title={`${fullLabel} · ${recorded ? "Belajar tercatat" : "Belum ada catatan"}`}
          >
            <span
              aria-hidden="true"
              className={`mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-full border-2 ${recorded ? "border-primary bg-accent text-primary" : index === 0 ? "border-input text-input" : "border-border/50 text-border"}`}
            >
              <Zap className="size-5 fill-current" strokeWidth={1.5} />
            </span>
            <span
              className={`mt-3 block text-sm ${index === 0 ? "font-extrabold text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </span>
            <span className="sr-only">
              {fullLabel}, {recorded ? "belajar tercatat" : "belum ada catatan"}
            </span>
          </li>
        ))}
      </ol>
      <dl className="rounded-button bg-muted px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Max streak</dt>
          <dd className="font-extrabold tabular-nums">{stats.longestStreak} hari</dd>
        </div>
      </dl>
    </Card>
  );
}
