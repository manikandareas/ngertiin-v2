import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./app";
import { ClerkRoot } from "./components/clerk-root";
import { ThemeProvider } from "./components/theme-provider";
import "./index.css";

function getRootElement(): HTMLElement {
  const element = document.getElementById("root");
  if (!element) {
    throw new Error("Root element was not found");
  }
  return element;
}
const rootElement = getRootElement();

const router = createBrowserRouter([
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
    </ThemeProvider>
  </StrictMode>,
);
