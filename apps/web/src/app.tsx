import { useAuth } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { isClerkConfigured } from "./config";
import { AppRoutes } from "./routes/app-routes";

export function App() {
  return isClerkConfigured ? <AccountApp /> : <UserApp />;
}

function AccountApp() {
  const { userId } = useAuth();
  return <UserApp key={userId ?? "signed-out"} />;
}

function UserApp() {
  // A new account gets a fresh cache and component tree. In-flight work from the old
  // account can only update its detached client, never the new account's state.
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
