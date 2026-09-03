import { ArrowRight, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { useCurrentUser } from "../features/current-user/api/use-current-user";

export default function DashboardPage() {
  const currentUser = useCurrentUser();

  return (
    <AppShell>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-10 md:grid-cols-[1.4fr_0.6fr] md:items-end"
      >
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Profil belajar terhubung
          </p>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
            {currentUser.data?.displayName
              ? `Selamat datang, ${currentUser.data.displayName}.`
              : "Selamat datang di Ngerti.in."}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Identitas lokal dan statistik belajar kamu sekarang tersinkron lewat API yang
            terautentikasi.
          </p>
          <Button asChild className="mt-8">
            <Link to="/profile">
              Atur profil <ArrowRight aria-hidden="true" className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-slate-100">
              <UserRound aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Statistik saya</p>
              <p className="text-xs text-slate-500">Timezone {currentUser.data?.timezone ?? "—"}</p>
            </div>
          </div>
          {currentUser.isPending ? (
            <p className="mt-8 text-sm text-slate-500">Memuat profil…</p>
          ) : currentUser.isError ? (
            <p className="mt-8 text-sm text-red-700">Profil belum dapat dimuat.</p>
          ) : (
            <dl className="mt-8 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-slate-500">Total XP</dt>
                <dd className="mt-1 text-2xl font-bold">{currentUser.data.stats.totalXp}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Streak</dt>
                <dd className="mt-1 text-2xl font-bold">
                  {currentUser.data.stats.currentStreak} hari
                </dd>
              </div>
            </dl>
          )}
        </div>
      </motion.section>
    </AppShell>
  );
}
