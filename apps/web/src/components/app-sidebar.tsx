import { UserButton, useUser } from "@clerk/react";
import {
  AddCircleHalfDotIcon,
  ArrowLeftDoubleIcon,
  ArrowRightDoubleIcon,
  BookOpen01Icon,
  Home01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ModuleSummary } from "@ngertiin/contracts/api";
import { type ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDashboard } from "../features/dashboard/api/use-dashboard";
import { SidebarModules } from "./sidebar-modules";
import { ThemeSelect } from "./theme-select";

const navigation = [
  { to: "/dashboard", label: "Beranda", icon: Home01Icon },
  { to: "/dashboard#module-composer", label: "Buat modul", icon: AddCircleHalfDotIcon },
  { to: "/modules", label: "Modul saya", icon: BookOpen01Icon },
];
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ConnectedAppSidebar() {
  const { user } = useUser();
  const dashboard = useDashboard();
  return (
    <AppSidebar
      name={user?.fullName || user?.firstName || "Akun belajar"}
      account={<UserButton />}
      modules={dashboard.data?.modules}
      pending={dashboard.isPending}
      error={dashboard.isError && !dashboard.data}
      retry={() => void dashboard.refetch()}
    />
  );
}

export function AppSidebar({
  name = "Akun belajar",
  account,
  modules,
  pending = false,
  error = false,
  retry,
}: {
  name?: string;
  account?: ReactNode;
  modules?: ModuleSummary[];
  pending?: boolean;
  error?: boolean;
  retry?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const labelClass = collapsed ? "lg:sr-only" : "";
  return (
    <aside
      aria-label="Sidebar"
      className={`flex shrink-0 flex-col border-b bg-sidebar text-sidebar-foreground lg:min-h-0 lg:border-r lg:border-b-0 ${collapsed ? "lg:w-16" : "lg:w-64"}`}
    >
      <div
        className={`flex items-center gap-2.5 px-5 py-3 pr-28 lg:py-5 ${collapsed ? "lg:flex-col lg:px-2" : "lg:px-3"}`}
      >
        <Link
          to="/dashboard"
          aria-label="ngerti.in — Beranda"
          title="ngerti.in"
          className={`flex min-h-8 min-w-0 flex-1 items-center rounded-sm px-1 font-display text-lg font-black tracking-tight ${focus}`}
        >
          <span className={collapsed ? "lg:hidden" : ""}>ngerti.in</span>
          {collapsed ? <span className="hidden lg:inline">n</span> : null}
          <span className="text-primary">.</span>
        </Link>
        <button
          type="button"
          aria-label={collapsed ? "Perluas sidebar" : "Kecilkan sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted ${focus} lg:flex`}
        >
          <HugeiconsIcon
            icon={collapsed ? ArrowRightDoubleIcon : ArrowLeftDoubleIcon}
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
      </div>
      <nav
        aria-label="Navigasi utama"
        className={`flex gap-1 px-3 pb-3 lg:flex-col lg:gap-1 lg:pb-0 ${collapsed ? "lg:px-2" : "lg:px-3"}`}
      >
        {navigation.map(({ to, label, icon }) => {
          let active = location.pathname.startsWith(to);
          if (to.includes("#")) {
            active = location.pathname === "/dashboard" && location.hash === "#module-composer";
          } else if (to === "/dashboard") {
            active = location.pathname === to && !location.hash;
          }
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              onClick={() => {
                if (to.includes("#")) document.getElementById("composer-text")?.focus();
              }}
              className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-caption sm:text-sm lg:min-h-10 lg:flex-none lg:justify-between lg:px-3 lg:text-sm ${focus} ${active ? "bg-muted text-foreground" : "hover:bg-muted"}`}
            >
              <span className={labelClass}>{label}</span>
              <HugeiconsIcon
                icon={icon}
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
                className={`hidden shrink-0 sm:block ${active ? "text-foreground" : "text-muted-foreground"} ${collapsed ? "lg:mx-auto" : ""}`}
              />
            </Link>
          );
        })}
      </nav>
      <div
        className={`mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${collapsed ? "hidden" : "hidden lg:block"}`}
      >
        <SidebarModules
          modules={modules}
          pending={pending && !modules}
          error={error}
          retry={retry}
        />
      </div>
      <div
        className={`absolute right-4 top-2 flex items-center gap-2 lg:static lg:mt-auto lg:border-t lg:py-2 ${collapsed ? "lg:mx-2 lg:flex-col lg:gap-1" : "lg:mx-4 lg:justify-between lg:gap-2"}`}
      >
        <div
          className={`flex min-w-0 items-center gap-2 ${collapsed ? "lg:justify-center" : "lg:flex-1"}`}
        >
          <div className="shrink-0">
            {account ?? (
              <Link
                to="/profile"
                aria-label="Profil"
                className={`grid size-8 place-items-center rounded-full bg-secondary text-secondary-foreground ${focus}`}
              >
                <HugeiconsIcon
                  icon={UserCircleIcon}
                  size={24}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </Link>
            )}
          </div>
          <Link
            to="/profile"
            title={name}
            className={`hidden min-w-0 truncate rounded-sm text-sm lg:block ${focus} ${labelClass}`}
          >
            {name}
          </Link>
        </div>
        <ThemeSelect />
      </div>
    </aside>
  );
}
