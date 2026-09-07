import type { Dashboard } from "@ngertiin/contracts/api";
import { Tooltip } from "radix-ui";

export function DashboardStats({ stats }: Pick<Dashboard, "stats">) {
  const xp = new Intl.NumberFormat("id-ID").format(stats.totalXp);
  const metrics = [
    {
      label: `Total XP: ${xp}`,
      value: `${xp} XP`,
      image: "/assets/diamond.png",
      color: "text-link",
      description: "Total XP yang kamu kumpulkan dari aktivitas belajar.",
      detail: null,
    },
    {
      label: `Streak: ${stats.currentStreak} hari beruntun`,
      value: `${stats.currentStreak} hari`,
      image: "/assets/fire.png",
      color: "text-foreground",
      description: "Jumlah hari kamu belajar berturut-turut.",
      detail: `Rekor terbaikmu: ${stats.longestStreak} hari.`,
    },
  ];

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-4">
        {metrics.map((metric) => (
          <Tooltip.Root key={metric.image}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                aria-label={metric.label}
                className={`flex min-h-10 items-center gap-2 rounded-sm font-display text-subheading font-extrabold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${metric.color}`}
              >
                <img
                  src={metric.image}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 shrink-0 object-contain"
                />
                <span>{metric.value}</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                sideOffset={8}
                collisionPadding={16}
                className="z-50 max-w-64 rounded-lg border-2 bg-popover px-4 py-3 text-caption leading-relaxed text-popover-foreground"
              >
                <p>{metric.description}</p>
                {metric.detail ? <p className="mt-2 font-bold">{metric.detail}</p> : null}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  );
}
