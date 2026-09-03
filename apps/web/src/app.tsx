import { useQuery } from "@tanstack/react-query";
import { readyHealthSchema, type ReadyHealth } from "@ngertiin/contracts/health";
import { Activity, ArrowRight, BookOpen, Server } from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { Button } from "./components/ui/button";
import { isClerkConfigured, webEnvironment } from "./config";

const ClerkSignIn = lazy(() => import("./components/clerk-sign-in"));

async function fetchApiHealth(): Promise<ReadyHealth> {
  const response = await fetch(`${webEnvironment.VITE_API_URL}/health/ready`);
  const body: unknown = await response.json();
  return readyHealthSchema.parse(body);
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f3] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-2 font-bold tracking-tight" to="/dashboard">
            <span className="grid size-8 place-items-center rounded-lg bg-teal-600 text-white">
              <BookOpen aria-hidden="true" className="size-4" />
            </span>
            Ngerti.in
          </Link>
          <Button asChild variant="outline">
            <Link to="/sign-in">Masuk</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">{children}</main>
    </div>
  );
}

function DashboardPage() {
  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: fetchApiHealth,
    retry: 1,
    refetchInterval: 30_000,
  });
  const isReady = health.data?.status === "ok";

  return (
    <AppShell>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-10 md:grid-cols-[1.4fr_0.6fr] md:items-end"
      >
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Fondasi belajar yang terhubung
          </p>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
            Bahan belajar masuk. Pemahaman yang keluar.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Bootstrap Ngerti.in siap untuk menerima fitur domain pada slice berikutnya.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-slate-100">
                <Server aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">API readiness</p>
                <p className="text-xs text-slate-500">Diperbarui otomatis</p>
              </div>
            </div>
            <Activity
              aria-label={isReady ? "API siap" : "API belum siap"}
              className={isReady ? "text-teal-600" : "text-amber-500"}
            />
          </div>
          <p className="mt-8 text-2xl font-bold">
            {health.isPending ? "Memeriksa…" : isReady ? "Semua sistem siap" : "Belum terhubung"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {health.error
              ? "Jalankan API dan infrastruktur lokal untuk melihat status."
              : "PostgreSQL, Redis, dan object storage dilaporkan oleh API."}
          </p>
        </div>
      </motion.section>
    </AppShell>
  );
}

function SignInPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-md flex-col items-center">
        {isClerkConfigured ? (
          <Suspense fallback={<p className="text-sm text-slate-500">Memuat halaman masuk…</p>}>
            <ClerkSignIn />
          </Suspense>
        ) : (
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Hubungkan Clerk</h1>
            <p className="mt-3 leading-7 text-slate-600">
              Isi VITE_CLERK_PUBLISHABLE_KEY di file .env untuk mengaktifkan halaman masuk.
            </p>
            <Button asChild className="mt-6">
              <Link to="/dashboard">
                Kembali ke dashboard <ArrowRight aria-hidden="true" className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}
