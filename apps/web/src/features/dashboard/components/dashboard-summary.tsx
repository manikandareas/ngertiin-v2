import type { Dashboard } from "@ngertiin/contracts/api";
import { DashboardStreakNote } from "./dashboard-streak-note";
import { DashboardStudySheet } from "./dashboard-study-sheet";

export function DashboardSummary({ data }: { data: Dashboard }) {
  return (
    <section
      aria-label="Ringkasan belajar"
      className="grid min-w-0 items-center gap-9 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10"
    >
      <DashboardStreakNote stats={data.stats} />
      <DashboardStudySheet
        continueLearning={data.continueLearning}
        hasModules={data.modules.length > 0}
      />
    </section>
  );
}
