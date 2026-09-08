import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";
import { ClerkRoot } from "./components/clerk-root";
import "./index.css";

const queryClient = new QueryClient();

function getRootElement(): HTMLElement {
  const element = document.getElementById("root");
  if (!element) {
    throw new Error("Root element was not found");
  }
  return element;
}
const rootElement = getRootElement();

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkRoot>
        <QueryClientProvider client={queryClient}>
          <NuqsAdapter>
            <App />
          </NuqsAdapter>
        </QueryClientProvider>
      </ClerkRoot>
    </BrowserRouter>
  </StrictMode>,
);
