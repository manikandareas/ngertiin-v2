import type { Dashboard } from "@ngertiin/contracts/api";
import type { ReactNode } from "react";
import { moduleOverviewRoute, nextLearningRoute } from "../../modules/next-learning-route";
import { DashboardModules } from "./dashboard-modules";
import { DashboardPractices } from "./dashboard-practices";
import { DashboardQuickActions } from "./dashboard-quick-actions";
import { DashboardSources } from "./dashboard-sources";
import { DashboardStats } from "./dashboard-stats";
import { DashboardTips } from "./dashboard-tips";
import { DashboardWelcome } from "./dashboard-welcome";

export function DashboardContent({ data, fallback }: { data?: Dashboard; fallback?: ReactNode }) {
  const resume = data?.continueLearning?.module;
  const readyModule =
    resume?.status === "ready" ? resume : data?.modules.find((module) => module.status === "ready");
  const chatHref = readyModule ? `/chat?moduleId=${readyModule.id}` : "/chat";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto w-full max-w-[1300px] px-5 pt-7 pb-14 sm:px-8 lg:px-10">
        <h1 className="sr-only">Beranda belajar</h1>
        <DashboardWelcome data={data} />
        {data ? (
          <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-4">
            <div className="lg:col-start-2 lg:row-start-1">
              <DashboardStats stats={data.stats} />
            </div>
            <div className="grid min-w-0 content-start gap-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
              <DashboardSources />
              <DashboardModules />
              <DashboardPractices />
            </div>
            <aside
              aria-label="Teman belajar"
              className="grid min-w-0 content-start gap-4 lg:col-start-2 lg:row-start-2"
            >
              <DashboardQuickActions moduleId={readyModule?.id} chatHref={chatHref} />
              <DashboardTips
                learningHref={
                  readyModule
                    ? (nextLearningRoute(readyModule.nextAction) ??
                      moduleOverviewRoute(readyModule))
                    : "/modules"
                }
                chatHref={chatHref}
              />
            </aside>
          </div>
        ) : (
          fallback
        )}
      </div>
    </div>
  );
}
