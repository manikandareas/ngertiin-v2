import { ArrowRight, BookOpen, Flame, Trophy, Zap } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { useDashboard } from "../features/dashboard/api/use-dashboard";
import { ModuleCard } from "../features/modules/components/module-card";
import { nextLearningRoute } from "../features/modules/next-learning-route";

export default function DashboardPage() {
  const dashboard = useDashboard();

  if (dashboard.isPending) {
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Memuat Dashboard…</p>
      </AppShell>
    );
  }
  if (dashboard.isError || !dashboard.data) {
    return (
      <AppShell>
        <section className="rounded-3xl border border-red-200 bg-white p-8">
          <h1 className="text-2xl font-bold">Dashboard belum dapat dimuat</h1>
          <p className="mt-3 text-slate-600">Periksa koneksi, lalu coba lagi.</p>
          <Button className="mt-6" onClick={() => dashboard.refetch()} variant="outline">
            Coba lagi
          </Button>
        </section>
      </AppShell>
    );
  }

  const { continueLearning, modules, stats } = dashboard.data;
  const destination = continueLearning
    ? (nextLearningRoute(continueLearning.module.nextAction) ??
      `/modules/${continueLearning.module.id}`)
    : null;
  const statCards = [
    { label: "Total XP", value: stats.totalXp, icon: Zap },
    { label: "Streak saat ini", value: `${stats.currentStreak} hari`, icon: Flame },
    { label: "Streak terpanjang", value: `${stats.longestStreak} hari`, icon: Trophy },
    { label: "Belajar terakhir", value: stats.lastLearningDate ?? "Belum ada", icon: BookOpen },
  ];

  return (
    <AppShell>
      <motion.section animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 10 }}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Dashboard belajar
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
              Lanjut dari yang paling berarti.
            </h1>
          </div>
          <Button asChild>
            <Link to="/modules/new">
              Buat Module <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>

        <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon }) => (
            <div className="rounded-2xl border border-slate-200 bg-white p-5" key={label}>
              <Icon className="size-5 text-teal-700" />
              <dt className="mt-4 text-xs text-slate-500">{label}</dt>
              <dd className="mt-1 text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">Continue Learning</h2>
          {continueLearning && destination ? (
            <div className="mt-5 rounded-3xl bg-slate-950 p-7 text-white sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
                Pilihan terbaik berikutnya
              </p>
              <h3 className="mt-3 text-3xl font-bold">
                {continueLearning.module.title ?? "Module sedang disusun"}
              </h3>
              {continueLearning.module.description ? (
                <p className="mt-3 max-w-2xl leading-7 text-slate-300">
                  {continueLearning.module.description}
                </p>
              ) : null}
              <Button asChild className="mt-6">
                <Link to={destination}>
                  Lanjutkan <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8">
              <h3 className="text-xl font-bold">Belum ada Module untuk dilanjutkan</h3>
              <p className="mt-2 text-slate-600">
                Buat Module pertamamu dari Source yang tersedia.
              </p>
              <Button asChild className="mt-5">
                <Link to="/modules/new">Buat Module</Link>
              </Button>
            </div>
          )}
        </section>

        {modules.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">Module terbaru</h2>
              <Link className="text-sm font-semibold text-teal-700" to="/modules">
                Lihat semua
              </Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          </section>
        ) : null}
      </motion.section>
    </AppShell>
  );
}
