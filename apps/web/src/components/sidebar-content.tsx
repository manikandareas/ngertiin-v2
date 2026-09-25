import { BookOpen01Icon, ChampionIcon, Home01Icon, LibraryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { isClerkConfigured } from "../config";
import { SidebarCreateActions } from "./sidebar-create-actions";
import { SidebarModuleSection, sidebarNavItemClass } from "./sidebar-module-section";

const navigation = [
  { to: "/dashboard", label: "Beranda", icon: Home01Icon },
  { to: "/modules", label: "Modul saya", icon: BookOpen01Icon },
  { to: "/sources", label: "Pustaka", icon: LibraryIcon },
  { to: "/leaderboard", label: "Leaderboard", icon: ChampionIcon },
];

export function SidebarContent({
  collapsed = false,
  usageBanner,
  currentModuleId,
  onNewChat,
  onNavigate,
}: {
  usageBanner?: ReactNode;
  currentModuleId?: string | null;
  onNewChat?: () => void;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const isChatPage = pathname === "/chat" || pathname.startsWith("/chat/");
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <nav
          aria-label="Navigasi utama"
          className={`grid shrink-0 gap-0.5 pt-1 ${collapsed ? "px-2" : "px-3"}`}
        >
          {navigation.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              aria-current={pathname === to ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`${sidebarNavItemClass} ${collapsed ? "justify-center px-0" : ""}`}
            >
              <HugeiconsIcon
                icon={icon}
                size={18}
                strokeWidth={1.5}
                aria-hidden="true"
                className="shrink-0"
              />
              <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
            </Link>
          ))}
        </nav>
        {isClerkConfigured ? (
          <SidebarModuleSection collapsed={collapsed} onNavigate={onNavigate} />
        ) : null}
      </div>
      <div className={`mt-auto shrink-0 space-y-3 py-4 ${collapsed ? "px-2" : "px-5"}`}>
        {!collapsed ? usageBanner : null}
        <SidebarCreateActions
          collapsed={collapsed}
          isChatPage={isChatPage}
          currentModuleId={currentModuleId}
          onNewChat={onNewChat}
          onNavigate={onNavigate}
        />
      </div>
    </>
  );
}
