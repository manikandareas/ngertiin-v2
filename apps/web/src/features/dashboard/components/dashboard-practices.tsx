import { useAuth } from "@clerk/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { PracticeCard, PracticeCardSkeleton } from "../../practice/components/practice-card";
import { practiceApi } from "../../practice/practice-api";

export function DashboardPractices() {
  const { getToken, userId } = useAuth();
  const query = useQuery({
    queryKey: ["practices", "recent", userId],
    queryFn: () => practiceApi(getToken).list(undefined, { archived: false, limit: 2 }),
    enabled: Boolean(userId),
    refetchInterval: (query) =>
      query.state.data?.data.some((practice) => practice.status === "generating") ? 3000 : false,
  });
  const practices = query.data?.data ?? [];
  return (
    <section aria-labelledby="dashboard-practice-heading" className="min-w-0">
      <header className="mb-5">
        <h2
          id="dashboard-practice-heading"
          className="font-display text-xl font-extrabold tracking-tight"
        >
          <Link
            to="/practices"
            className="inline-flex items-center gap-1.5 text-inherit underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Coba ingat lagi
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
              className="shrink-0"
            />
          </Link>
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Practice terbaru, siap kamu buka kembali.
        </p>
      </header>
      {query.isPending ? (
        <div role="status">
          <span className="sr-only">Memuat Practice…</span>
          <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
            <PracticeCardSkeleton />
            <PracticeCardSkeleton />
          </div>
        </div>
      ) : query.isError ? (
        <div role="alert" className="rounded-card border bg-card p-5">
          <p className="text-sm">Practice belum dapat dimuat.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : practices.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {practices.map((practice) => (
            <li className="min-w-0" key={practice.id}>
              <PracticeCard practice={practice} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-card border border-dashed p-6">
          <h3 className="font-display text-base font-bold">Sudah seberapa ngerti?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Buka modul untuk membuat kuis, flashcard, atau exam dari materimu.
          </p>
          <Button asChild variant="link" size="sm" className="mt-2 px-0">
            <Link to="/modules">Pilih modul</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
