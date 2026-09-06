import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { AuthenticatedRoute } from "./authenticated-route";

const DashboardPage = lazy(() => import("../pages/dashboard"));
const NewModulePage = lazy(() => import("../pages/new-module"));
const ModulesPage = lazy(() => import("../pages/modules"));
const ModuleStatusPage = lazy(() => import("../pages/module-status"));
const ModuleJourneyPage = lazy(() => import("../pages/module-journey"));
const ModuleNodePage = lazy(() => import("../pages/module-node"));
const AdaptiveInterventionPage = lazy(() => import("../pages/adaptive-intervention"));
const ProfilePage = lazy(() => import("../pages/profile"));
const SignInPage = lazy(() => import("../pages/sign-in"));

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="text-sm text-slate-500">Memuat halaman…</p>
        </AppShell>
      }
    >
      <Routes>
        <Route
          path="/adaptive-interventions/:interventionId"
          element={
            <AuthenticatedRoute>
              <AdaptiveInterventionPage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AuthenticatedRoute>
              <DashboardPage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/modules"
          element={
            <AuthenticatedRoute>
              <ModulesPage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/modules/new"
          element={
            <AuthenticatedRoute>
              <NewModulePage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/modules/:moduleId/journey"
          element={
            <AuthenticatedRoute>
              <ModuleJourneyPage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/modules/:moduleId/nodes/:nodeId"
          element={
            <AuthenticatedRoute>
              <ModuleNodePage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/modules/:moduleId"
          element={
            <AuthenticatedRoute>
              <ModuleStatusPage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthenticatedRoute>
              <ProfilePage />
            </AuthenticatedRoute>
          }
        />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="*" element={<Navigate replace to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
}
