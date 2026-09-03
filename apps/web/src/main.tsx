import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    <ClerkRoot>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkRoot>
  </StrictMode>,
);
