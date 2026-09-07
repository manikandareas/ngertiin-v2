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
import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { UsageBanner } from "../features/usage/usage-banner";
import { useUsageSync } from "../features/usage/use-usage-sync";
import { ThemeToggle } from "./theme-toggle";

const navigation = [
  { to: "/dashboard", label: "Beranda", icon: Home01Icon },
  { to: "/modules/new", label: "Buat modul", icon: AddCircleHalfDotIcon },
  { to: "/modules", label: "Modul saya", icon: BookOpen01Icon },
];
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ConnectedAppSidebar() {
  useUsageSync();
  const { user } = useUser();
  return (
    <AppSidebar
      name={user?.fullName || user?.firstName || "Akun belajar"}
      account={<UserButton />}
      usageBanner={<UsageBanner />}
    />
  );
}

export function AppSidebar({
  name = "Akun belajar",
  account,
  usageBanner,
}: {
  name?: string;
  account?: ReactNode;
  usageBanner?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (location.key) setMenuOpen(false);
  }, [location.key]);
  useEffect(() => {
    const desktop = matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const activeRoute = navigation.find(({ to }) =>
    to === "/modules"
      ? (location.pathname === to || location.pathname.startsWith(`${to}/`)) &&
        !location.pathname.startsWith("/modules/new")
      : location.pathname === to || location.pathname.startsWith(`${to}/`),
  )?.to;
  const labelClass = collapsed ? "sr-only" : "";
  return (
    <>
      <aside
        aria-label="Sidebar"
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar text-sidebar-foreground xl:flex ${collapsed ? "xl:w-16" : "xl:w-64"}`}
      >
        <div className={`flex items-center gap-2.5 py-5 ${collapsed ? "flex-col px-2" : "px-3"}`}>
          <Link
            to="/dashboard"
            aria-label="ngerti.in — Beranda"
            title="ngerti.in"
            className={`flex min-h-8 min-w-0 flex-1 items-center rounded-sm px-1 font-display text-lg font-black tracking-tight ${focus}`}
          >
            <span className={collapsed ? "hidden" : ""}>ngerti.in</span>
            {collapsed ? <span className="inline">n</span> : null}
            <span className="text-primary">.</span>
          </Link>
          <button
            type="button"
            aria-label={collapsed ? "Perluas sidebar" : "Kecilkan sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted ${focus}`}
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
          className={`flex flex-col gap-1 ${collapsed ? "px-2" : "px-3"}`}
        >
          {navigation.map(({ to, label, icon }) => {
            const active = activeRoute === to;
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={`flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-full px-3 text-sm ${focus} ${active ? "bg-muted text-foreground" : "hover:bg-muted"}`}
              >
                <span className={labelClass}>{label}</span>
                <HugeiconsIcon
                  icon={icon}
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={`shrink-0 ${active ? "text-foreground" : "text-muted-foreground"} ${collapsed ? "mx-auto" : ""}`}
                />
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          {!collapsed && usageBanner ? <div className="px-3 pb-4 pt-8">{usageBanner}</div> : null}
          <div
            className={`flex items-center border-t py-2 ${collapsed ? "mx-2 flex-col gap-1" : "mx-4 justify-between gap-2"}`}
          >
            <div
              className={`flex min-w-0 items-center gap-2 ${collapsed ? "justify-center" : "flex-1"}`}
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
                className={`min-w-0 truncate rounded-sm text-sm ${focus} ${labelClass}`}
              >
                {name}
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <header className="flex shrink-0 items-center justify-between border-b bg-background px-5 py-3 xl:hidden">
        <Link
          to="/dashboard"
          aria-label="ngerti.in — Beranda"
          className={`rounded-sm font-display text-xl font-black tracking-tight ${focus}`}
        >
          ngerti.in<span className="text-primary">.</span>
        </Link>
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Buka menu navigasi"
              className={`grid size-11 place-items-center rounded-full hover:bg-muted ${focus}`}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[calc(100%-2rem)] flex-col overflow-y-auto border-r bg-background p-5 shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left duration-200 motion-reduce:animate-none"
            >
              <div className="mb-6 flex items-center justify-between">
                <Dialog.Title className="font-display text-xl font-black">
                  ngerti.in<span className="text-primary">.</span>
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Tutup menu"
                    className={`grid size-11 place-items-center rounded-full hover:bg-muted ${focus}`}
                  >
                    <X size={22} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <nav aria-label="Navigasi utama" className="flex flex-col gap-1">
                {navigation.map(({ to, label, icon }) => {
                  const active = activeRoute === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center justify-between gap-2 rounded-full px-3 text-sm ${focus} ${active ? "bg-muted text-foreground" : "hover:bg-muted"}`}
                    >
                      {label}
                      <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} aria-hidden="true" />
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto">
                {usageBanner ? <div className="pb-4 pt-8">{usageBanner}</div> : null}
                <div className="flex items-center gap-2 border-t pt-3">
                  {account}
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className={`min-w-0 flex-1 truncate rounded-sm text-sm ${focus}`}
                  >
                    {name}
                  </Link>
                  <ThemeToggle />
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>
    </>
  );
}
