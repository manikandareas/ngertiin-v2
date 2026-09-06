import type { Dashboard } from "@ngertiin/contracts/api";
import type { ReactNode } from "react";
import { DashboardModules } from "./dashboard-modules";
import { DashboardSummary } from "./dashboard-summary";

export function DashboardContent({
  data,
  name,
  composer,
  fallback,
  composerVisible = false,
}: {
  data?: Dashboard;
  name?: string;
  composer?: ReactNode;
  fallback?: ReactNode;
  composerVisible?: boolean;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl px-5 pt-9 pb-12 sm:px-9 lg:px-16 lg:pt-16">
        <header className="mb-10 lg:mb-12">
          <h1 className="break-words font-display text-heading-sm font-bold tracking-tight sm:text-heading">
            <span className="box-decoration-clone rounded-button bg-secondary px-3 py-1 leading-[1.6] text-secondary-foreground">
              Halo{name ? `, ${name}` : " lagi"}!{" "}
              <span aria-hidden="true" className="welcome-wave">
                👋
              </span>
            </span>
          </h1>
          <p className="mt-3 text-balance text-xl font-medium leading-snug text-muted-foreground sm:text-heading-sm">
            Mau ngerti apa hari ini?
          </p>
        </header>
        {data ? (
          <>
            <DashboardSummary data={data} />
            <div className="mt-8">
              <DashboardModules modules={data.modules} continueLearning={data.continueLearning} />
            </div>
          </>
        ) : (
          fallback
        )}
        {composer ? (
          <div hidden={!composerVisible} className="mt-6">
            {composer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
