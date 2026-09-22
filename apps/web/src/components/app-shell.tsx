import type { ReactNode } from "react";
import { isClerkConfigured } from "../config";
import { AppSidebar, ConnectedAppSidebar } from "./app-sidebar";

export function AppShell({
  children,
  sidebar,
  rightSidebar,
  workspace = false,
  unsavedChanges = false,
  hideMobileSidebarHeader = false,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  rightSidebar?: ReactNode;
  workspace?: boolean;
  unsavedChanges?: boolean;
  hideMobileSidebarHeader?: boolean;
}) {
  return (
    <div className="fixed inset-0 flex h-dvh flex-col overflow-hidden bg-background text-foreground xl:flex-row">
      {sidebar ??
        (isClerkConfigured ? (
          <ConnectedAppSidebar
            unsavedChanges={unsavedChanges}
            hideMobileHeader={hideMobileSidebarHeader}
          />
        ) : (
          <AppSidebar hideMobileHeader={hideMobileSidebarHeader} />
        ))}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <main
          className={`min-h-0 min-w-0 flex-1 ${workspace ? "flex flex-col" : "overflow-y-auto"}`}
        >
          {workspace ? (
            children
          ) : (
            <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-16">{children}</div>
          )}
        </main>
        {rightSidebar}
      </div>
    </div>
  );
}
