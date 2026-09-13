import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthLayout } from "../components/auth-layout";
import { AuthenticatedRoute } from "./authenticated-route";

const ChatDetailPage = lazy(() => import("../pages/chat-detail"));
const ChatPage = lazy(() => import("../pages/chat"));
const LeaderboardPage = lazy(() => import("../pages/leaderboard"));
const DashboardPage = lazy(() => import("../pages/dashboard"));
const NewModulePage = lazy(() => import("../pages/new-module"));
const SourceDetailPage = lazy(() => import("../pages/source-detail"));
const SourcesPage = lazy(() => import("../pages/sources"));
const ModulesPage = lazy(() => import("../pages/modules"));
const ModuleStatusPage = lazy(() => import("../pages/module-status"));
const ModuleJourneyPage = lazy(() => import("../pages/module-journey"));
const ModuleNodePage = lazy(() => import("../pages/module-node"));
const AdaptiveInterventionPage = lazy(() => import("../pages/adaptive-intervention"));
const SettingsPage = lazy(() => import("../pages/settings"));
const AccountCallbackPage = lazy(() => import("../pages/account-callback"));
const SignInPage = lazy(() => import("../pages/sign-in"));
const SignUpPage = lazy(() => import("../pages/sign-up"));

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <p className="text-center text-sm text-muted-foreground">Memuat halaman…</p>
        </AuthLayout>
      }
    >
      <Routes>
        <Route
          element={
            <AuthenticatedRoute>
              <Outlet />
            </AuthenticatedRoute>
          }
        >
          <Route
            path="/adaptive-interventions/:interventionId"
            element={<AdaptiveInterventionPage />}
          />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:threadId" element={<ChatDetailPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/sources/:sourceId" element={<SourceDetailPage />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/modules/new" element={<NewModulePage />} />
          <Route path="/modules/:moduleId/journey" element={<ModuleJourneyPage />} />
          <Route path="/modules/:moduleId/nodes/:nodeId" element={<ModuleNodePage />} />
          <Route path="/modules/:moduleId" element={<ModuleStatusPage />} />
          <Route path="/profile" element={<Navigate replace to="/settings?tab=account" />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/account-callback" element={<AccountCallbackPage />} />
        </Route>
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="*" element={<Navigate replace to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
}
