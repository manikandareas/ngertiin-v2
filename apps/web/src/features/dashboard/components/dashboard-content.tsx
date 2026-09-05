import type { Dashboard } from "@ngertiin/contracts/api";
import { CreateModuleCard } from "./create-module-card";
import { DashboardModules } from "./dashboard-modules";
import { LearningBanner } from "./learning-banner";
import { LearningStreakCard } from "./learning-streak-card";
import { LearningXpCard } from "./learning-xp-card";

export function DashboardContent({ data }: { data: Dashboard }) {
  const { stats, modules, continueLearning } = data;
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-14">
      <aside aria-label="Ringkasan belajar" className="order-2 space-y-5 lg:order-0">
        <LearningStreakCard stats={stats} />
        <CreateModuleCard />
        <LearningXpCard totalXp={stats.totalXp} />
      </aside>
      <div className="min-w-0">
        <LearningBanner />
        <DashboardModules modules={modules} continueLearning={continueLearning} />
      </div>
    </div>
  );
}
