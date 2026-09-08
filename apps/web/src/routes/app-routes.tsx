import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthLayout } from "../components/auth-layout";
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/modules/new" element={<NewModulePage />} />
          <Route path="/modules/:moduleId/journey" element={<ModuleJourneyPage />} />
          <Route path="/modules/:moduleId/nodes/:nodeId" element={<ModuleNodePage />} />
          <Route path="/modules/:moduleId" element={<ModuleStatusPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="*" element={<Navigate replace to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
}
