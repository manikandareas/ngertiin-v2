import { ArrowRightDoubleIcon, BookOpen01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dashboard } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";
import { moduleOverviewRoute, nextLearningRoute } from "../../modules/next-learning-route";

type DashboardSummaryProps = { data: Dashboard };

export function DashboardSummary({ data }: DashboardSummaryProps) {
  const recent = [...data.modules]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 3);
  const resume = data.continueLearning?.module;
  return (
    <section aria-label="Ringkasan belajar" className="grid gap-5 sm:grid-cols-2">
      <div className="min-w-0 rounded-card border border-[#e8dfb8] bg-[#fffbe8] p-5 text-[#785515] sm:p-6 dark:border-[#454137] dark:bg-[#2b2923] dark:text-[#d5c9a6]">
        <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold">
          <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
          Terakhir diperbarui
        </h2>
        {recent.length ? (
          <ul className="space-y-4">
            {recent.map((module) => (
              <li key={module.id}>
                <Link
                  to={moduleOverviewRoute(module)}
                  className="flex items-center gap-3 rounded-sm text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <HugeiconsIcon
                    icon={BookOpen01Icon}
                    size={16}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span className="truncate">{module.title ?? "Modul baru"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-xs text-sm leading-relaxed">
            Setiap hal besar dimulai dari rasa penasaran. Modul pertamamu akan muncul di sini.
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-col rounded-card border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm text-muted-foreground">
          <HugeiconsIcon icon={SparklesIcon} size={18} strokeWidth={1.5} aria-hidden="true" />
          {resume ? "Lanjutkan langkah terakhir" : "Langkah pertama"}
        </h2>
        <h3 className="mt-5 text-pretty text-lg font-semibold leading-relaxed">
          {resume?.title ?? "Rasa penasaranmu mulai di sini."}
        </h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
          <p className="text-sm text-muted-foreground">
            {resume
              ? [
                  resume.progress ? `${Math.round(resume.progress.percentage)}% selesai` : null,
                  resume.estimatedMinutes ? `${resume.estimatedMinutes} menit` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Tambahkan materi, lalu belajar selangkah demi selangkah."}
          </p>
          <Link
            to={
              resume
                ? (nextLearningRoute(resume.nextAction) ?? moduleOverviewRoute(resume))
                : "/modules/new"
            }
            className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-link hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {resume ? "Lanjutkan" : "Buat modul"}
            <HugeiconsIcon icon={ArrowRightDoubleIcon} size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="rounded-card border bg-card p-5 sm:p-6">
        <h2 className="text-sm text-muted-foreground">Ritme belajarmu</h2>
        <p className="mt-3 text-xl font-semibold tabular-nums">
          {data.stats.currentStreak} hari beruntun
        </p>
        <p className="mt-2 text-caption text-muted-foreground">
          Rekor terpanjang: {data.stats.longestStreak} hari
        </p>
      </div>
      <div className="rounded-card border bg-card p-5 sm:p-6">
        <h2 className="text-sm text-muted-foreground">Total XP</h2>
        <p className="mt-3 text-xl font-semibold tabular-nums">
          {new Intl.NumberFormat("id-ID").format(data.stats.totalXp)} XP
        </p>
        <p className="mt-2 text-caption text-muted-foreground">
          Terus bertumbuh di setiap sesi belajar.
        </p>
      </div>
    </section>
  );
}
