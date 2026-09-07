import type { Dashboard } from "@ngertiin/contracts/api";

export function DashboardStreakNote({ stats }: Pick<Dashboard, "stats">) {
  const { currentStreak, longestStreak } = stats;
  const atBest = currentStreak > 0 && currentStreak >= longestStreak;

  let message = "Satu sesi belajar bisa jadi awal kebiasaan baik.";
  if (atBest) message = "Ini rekor terbaikmu. Keren, terus bertumbuh!";
  else if (currentStreak > 0) message = "Sedikit tiap hari, makin banyak yang kamu ngerti.";

  return (
    <aside
      aria-labelledby="streak-note-heading"
      className="lg:-rotate-3 shadow-[3px_5px_0_color-mix(in_srgb,var(--adaptive)_12%,transparent)] after:absolute after:-right-px after:-bottom-px after:size-5.5 after:bg-adaptive after:opacity-30 after:[clip-path:polygon(0_0,100%_0,0_100%)] after:content-[''] relative min-w-0 border border-adaptive/40 bg-adaptive-subtle px-6 pt-6 pb-8 text-adaptive-foreground"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 left-1/3 h-6 w-20 rotate-3 border border-adaptive/20 bg-adaptive/20"
      />
      <h2 id="streak-note-heading" className="font-display text-base font-extrabold">
        {currentStreak ? "Lagi panas-panasnya!" : "Nyalakan semangatmu!"}
      </h2>
      <div className="mt-5 flex items-center gap-3">
        <img
          src="/assets/fire.png"
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 object-contain"
        />
        <p className="min-w-0 font-display">
          <span className="break-words text-display font-extrabold leading-none tabular-nums">
            {currentStreak}
          </span>
          <span className="mt-1 block text-caption font-bold">hari beruntun</span>
        </p>
      </div>
      <p className="mt-5 text-caption leading-relaxed">{message}</p>
      <p className="mt-4 text-caption font-bold tabular-nums">
        Rekor terbaik: {longestStreak} hari
      </p>
    </aside>
  );
}
