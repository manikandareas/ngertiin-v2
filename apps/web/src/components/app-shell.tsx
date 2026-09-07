import type { ReactNode } from "react";
import { isClerkConfigured } from "../config";
import { AppSidebar, ConnectedAppSidebar } from "./app-sidebar";

export function AppShell({
  children,
  sidebar,
  workspace = false,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  workspace?: boolean;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden xl:flex-row bg-background text-foreground">
      {sidebar ?? (isClerkConfigured ? <ConnectedAppSidebar /> : <AppSidebar />)}
      <main className={`min-h-0 min-w-0 flex-1 ${workspace ? "flex flex-col" : "overflow-y-auto"}`}>
        {workspace ? (
          children
        ) : (
          <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-16">{children}</div>
        )}
      </main>
    </div>
  );
}
