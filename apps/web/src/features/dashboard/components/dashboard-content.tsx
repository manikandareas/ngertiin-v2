import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dashboard } from "@ngertiin/contracts/api";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { DashboardModules } from "./dashboard-modules";
import { DashboardStats } from "./dashboard-stats";
import { DashboardSummary } from "./dashboard-summary";

export function DashboardContent({
  data,
  name,
  fallback,
}: {
  data?: Dashboard;
  name?: string;
  fallback?: ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 pt-10 pb-14 sm:px-10 lg:px-14 lg:pt-14">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-6 sm:mb-14">
          <div className="min-w-0">
            <h1 className="font-display text-heading-sm font-extrabold tracking-tight sm:text-heading">
              Ruang kecil untuk
              <br />
              <span className="relative isolate inline-block px-2 text-secondary-foreground before:absolute before:-inset-x-0.5 before:top-px before:-bottom-0.5 before:-z-1 before:rounded-[35%_18%_28%_15%] before:bg-secondary before:content-['']">
                rasa penasaranmu.
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Halo{name ? `, ${name}` : " lagi"}. Mau ngerti apa hari ini?
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {data ? <DashboardStats stats={data.stats} /> : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/modules/new">
                <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
                Buat modul
              </Link>
            </Button>
          </div>
        </header>
        {data ? (
          <>
            <DashboardSummary data={data} />
            <div className="mt-12 sm:mt-14">
              <DashboardModules />
            </div>
          </>
        ) : (
          fallback
        )}
      </div>
    </div>
  );
}
