import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { useSources } from "../../sources/api/use-sources";
import { SourceCard } from "../../sources/source-card";
import { DashboardAddSource } from "./dashboard-add-source";

export function DashboardSources() {
  const query = useSources({ archived: "false", limit: 2 });
  const sources = query.data?.pages[0]?.data ?? [];
  const navigate = useNavigate();

  return (
    <section aria-labelledby="dashboard-sources-heading" className="min-w-0">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2
            id="dashboard-sources-heading"
            className="font-display text-xl font-extrabold tracking-tight"
          >
            <Link
              to="/sources"
              className="inline-flex items-center gap-1.5 text-inherit underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Materi belajarmu
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
            Dari yang kamu simpan, jadi yang kamu pahami.
          </p>
        </div>
      </header>
      {query.isPending ? (
        <p role="status" className="mb-4 py-6 text-sm text-muted-foreground">
          Memuat materi…
        </p>
      ) : null}
      {query.isError ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <p>Materi belum dapat dimuat.</p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 min-[86rem]:grid-cols-[1fr_1fr_0.8fr]">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            onPreview={(item) =>
              navigate(`/sources/${item.id}`, { state: { returnTo: "/dashboard" } })
            }
          />
        ))}
        <DashboardAddSource />
      </div>
    </section>
  );
}
