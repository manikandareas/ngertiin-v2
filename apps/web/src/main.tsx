import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./app";
import { ClerkRoot } from "./components/clerk-root";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import "./index.css";

function getRootElement(): HTMLElement {
  const element = document.getElementById("root");
  if (!element) {
    throw new Error("Root element was not found");
  }
  return element;
}
const rootElement = getRootElement();

const DesignSystemPage = lazy(() => import("./pages/design-system"));

const DesignSystemProposalPage = lazy(() => import("./pages/design-system-proposal"));

const router = createBrowserRouter([
  {
    path: "/design-system/proposal",
    element: (
      <Suspense fallback={<p className="p-8">Memuat proposal…</p>}>
        <DesignSystemProposalPage />
      </Suspense>
    ),
  },
  {
    path: "/design-system",
    element: (
      <Suspense fallback={<p className="p-8">Memuat design system…</p>}>
        <DesignSystemPage />
      </Suspense>
    ),
  },
  {
    path: "*",
    element: (
      <ClerkRoot>
        <NuqsAdapter>
          <App />
        </NuqsAdapter>
      </ClerkRoot>
    ),
  },
]);

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="ngertiin-theme">
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);
