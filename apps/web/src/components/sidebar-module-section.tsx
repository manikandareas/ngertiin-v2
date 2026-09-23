import { Chat01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileText, Map as MapIcon } from "lucide-react";
import { Link, useLocation, useMatch } from "react-router-dom";
import { useCurrentUser } from "../features/current-user/api/use-current-user";
import { useJourney, useModule } from "../features/modules/api/use-modules";
import { ModuleSwitcher } from "./module-switcher";

export const sidebarNavItemClass =
  "flex min-h-11 min-w-0 items-center gap-2.5 rounded-full px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none xl:min-h-9";

export function SidebarModuleSection({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { pathname, search } = useLocation();
  const match = useMatch("/modules/:moduleId/*");
  const routeId = match?.params.moduleId;
  const currentUser = useCurrentUser();
  const routeModuleId =
    (routeId === "new" ? undefined : routeId) ??
    (pathname === "/modules/new" || pathname === "/chat"
      ? new URLSearchParams(search).get("moduleId")
      : null) ??
    undefined;
  const routeModule = useModule(routeModuleId);
  const moduleId =
    routeModule.data?.status === "archived"
      ? (currentUser.data?.currentModuleId ?? undefined)
      : (routeModuleId ?? currentUser.data?.currentModuleId ?? undefined);
  const module = useModule(moduleId);
  return (
    <section aria-label="Modul belajar" className={collapsed ? "px-2" : "px-3"}>
      <div className="my-2.5 border-t border-sidebar-border" />
      <ModuleSwitcher
        collapsed={collapsed}
        selectedId={moduleId}
        title={moduleId ? (module.data?.title ?? "Modul belajar") : "Pilih modul"}
        imageUrl={module.data?.imageUrl}
        onNavigate={onNavigate}
      />
      {module.data ? (
        <>
          <nav aria-label="Navigasi modul" className="mt-2 grid gap-0.5">
            <Link
              to={
                module.data.status === "ready"
                  ? `/modules/${moduleId}/journey`
                  : `/modules/${moduleId}`
              }
              onClick={onNavigate}
              title={collapsed ? "Journey" : undefined}
              aria-current={pathname.startsWith(`/modules/${moduleId}`) ? "page" : undefined}
              className={`${sidebarNavItemClass} ${collapsed ? "justify-center px-0" : ""}`}
            >
              <MapIcon className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className={collapsed ? "sr-only" : "truncate"}>Journey</span>
            </Link>
            {module.data.status === "ready" ? (
              <Link
                to={`/chat?moduleId=${moduleId}`}
                onClick={onNavigate}
                title={collapsed ? "Obrolan modul" : undefined}
                aria-current={pathname === "/chat" ? "page" : undefined}
                className={`${sidebarNavItemClass} ${collapsed ? "justify-center px-0" : ""}`}
              >
                <HugeiconsIcon icon={Chat01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
                <span className={collapsed ? "sr-only" : "truncate"}>Obrolan</span>
              </Link>
            ) : null}
          </nav>
          {!collapsed && module.data.status === "ready" && moduleId ? (
            <ModuleSources moduleId={moduleId} onNavigate={onNavigate} />
          ) : null}
        </>
      ) : null}
      {moduleId && module.isError && !collapsed ? (
        <p role="alert" className="px-3 py-2 text-xs text-muted-foreground">
          Modul belum dapat dimuat.{" "}
          <button type="button" className="underline" onClick={() => void module.refetch()}>
            Coba lagi
          </button>
        </p>
      ) : null}
    </section>
  );
}

function ModuleSources({ moduleId, onNavigate }: { moduleId: string; onNavigate?: () => void }) {
  const journey = useJourney(moduleId);
  return (
    <section aria-label="Materi modul" className="mt-2">
      <h2 className="px-3 py-2 text-xs font-semibold text-muted-foreground">Materi</h2>
      {journey.isPending ? (
        <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
          Memuat materi…
        </p>
      ) : null}
      {journey.isError ? (
        <p role="alert" className="px-3 py-2 text-xs text-muted-foreground">
          Materi belum dapat dimuat.{" "}
          <button type="button" className="underline" onClick={() => void journey.refetch()}>
            Coba lagi
          </button>
        </p>
      ) : null}
      {journey.data?.sources.map((source) => (
        <Link
          key={source.id}
          to={`/sources/${source.id}`}
          onClick={onNavigate}
          title={source.title}
          className="flex min-h-9 min-w-0 items-center gap-3 rounded-lg px-3 text-xs text-muted-foreground hover:bg-muted hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <FileText className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">{source.title}</span>
        </Link>
      ))}
      {journey.data && !journey.data.sources.length ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">Belum ada materi.</p>
      ) : null}
    </section>
  );
}
