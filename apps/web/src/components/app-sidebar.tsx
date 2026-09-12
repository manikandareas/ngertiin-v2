import { useClerk, useUser } from "@clerk/react";
import {
  AddCircleHalfDotIcon,
  BookOpen01Icon,
  ChampionIcon,
  Chat01Icon,
  Home01Icon,
  LibraryIcon,
  SidebarLeftIcon,
  SidebarRightIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { isClerkConfigured } from "../config";
import { ChatSidebarSection } from "../features/chat/components/chat-sidebar-section";
import { useCurrentUser } from "../features/current-user/api/use-current-user";
import { UsageBanner } from "../features/usage/usage-banner";
import { useUsageSync } from "../features/usage/use-usage-sync";
import { NavUser, type NavUserProps } from "./nav-user";

const navigation = [
  { to: "/modules/new", label: "Buat modul", icon: AddCircleHalfDotIcon },
  { to: "/dashboard", label: "Beranda", icon: Home01Icon },
  { to: "/modules", label: "Modul belajar", icon: BookOpen01Icon },
  { to: "/chat", label: "Chat", icon: Chat01Icon },
  { to: "/sources", label: "Pustaka saya", icon: LibraryIcon },
  { to: "/leaderboard", label: "Leaderboard", icon: ChampionIcon },
];
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const navItemBaseClass = `flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150 motion-reduce:transition-none xl:min-h-9 ${focus}`;
const navItemClass = `${navItemBaseClass} font-medium text-muted-foreground hover:bg-muted hover:text-sidebar-foreground aria-[current=page]:bg-muted aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-foreground`;
const createModuleClass = `${navItemBaseClass} font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent/80 aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-sidebar-accent-foreground/30`;

export function ConnectedAppSidebar({ unsavedChanges = false }: { unsavedChanges?: boolean }) {
  useUsageSync();
  const user = useCurrentUser();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  return (
    <AppSidebar
      user={{
        name: user.data?.displayName || clerkUser?.fullName || "Akun belajar",
        email: clerkUser?.primaryEmailAddress?.emailAddress,
        avatarUrl: user.data?.avatarUrl || clerkUser?.imageUrl,
        unsavedChanges,
        onLogout: () => signOut({ redirectUrl: "/sign-in" }),
      }}
      usageBanner={<UsageBanner />}
    />
  );
}

export function AppSidebar({
  user = { name: "Akun belajar" },
  usageBanner,
}: {
  user?: Omit<NavUserProps, "collapsed" | "side">;
  usageBanner?: ReactNode;
}) {
  const location = useLocation();
  const isChatPage = location.pathname === "/chat" || location.pathname.startsWith("/chat/");
  const [collapsed, setCollapsed] = useState(!isChatPage);
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
  const usage =
    usageBanner && isChatPage ? (
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer rounded-lg px-2 py-2 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          Usage minggu ini
        </summary>
        <div className="mt-2">{usageBanner}</div>
      </details>
    ) : (
      usageBanner
    );
  const activeRoute = navigation.find(({ to }) =>
    to === "/modules"
      ? (location.pathname === to || location.pathname.startsWith(`${to}/`)) &&
        !location.pathname.startsWith("/modules/new")
      : location.pathname === to || location.pathname.startsWith(`${to}/`),
  )?.to;
  return (
    <>
      <aside
        aria-label="Sidebar"
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground xl:flex ${isChatPage ? "overflow-hidden" : "overflow-y-auto"} ${collapsed ? "xl:w-16" : "xl:w-64"}`}
      >
        <div className={`flex items-center gap-2.5 py-3 ${collapsed ? "flex-col px-2" : "px-3"}`}>
          <Link
            to="/dashboard"
            aria-label="ngerti.in — Beranda"
            title="ngerti.in"
            className={`flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-sm px-1 font-display text-lg font-black tracking-tight ${focus}`}
          >
            <img
              src="/ngertiin-mascot.webp"
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 object-contain"
            />
            {!collapsed && (
              <span>
                ngerti.in<span className="text-primary">.</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            aria-label={collapsed ? "Perluas sidebar" : "Kecilkan sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted ${focus}`}
          >
            <HugeiconsIcon
              icon={collapsed ? SidebarRightIcon : SidebarLeftIcon}
              size={20}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
        </div>
        <nav
          aria-label="Navigasi utama"
          className={`flex shrink-0 flex-col gap-0.5 ${collapsed ? "px-2" : "px-3"}`}
        >
          {navigation.map(({ to, label, icon }) => {
            const active = activeRoute === to;
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={`${to === "/modules/new" ? createModuleClass : navItemClass} ${collapsed ? "justify-center" : ""}`}
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
            );
          })}
        </nav>
        {isChatPage && isClerkConfigured ? <ChatSidebarSection collapsed={collapsed} /> : null}
        <div className="mt-auto shrink-0">
          {!collapsed && usage ? <div className="px-3 pb-4 pt-4">{usage}</div> : null}
          <div className="border-t p-2">
            <NavUser {...user} collapsed={collapsed} />
          </div>
        </div>
      </aside>
      <header className="flex shrink-0 items-center justify-between border-b bg-background px-5 py-3 xl:hidden">
        <Link
          to="/dashboard"
          aria-label="ngerti.in — Beranda"
          className={`flex items-center gap-2 rounded-sm font-display text-xl font-black tracking-tight ${focus}`}
        >
          <img
            src="/ngertiin-mascot.webp"
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 object-contain"
          />
          <span>
            ngerti.in<span className="text-primary">.</span>
          </span>
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
              className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[calc(100%-2rem)] flex-col ${isChatPage ? "overflow-hidden" : "overflow-y-auto"} border-r bg-background p-5 shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left duration-200 motion-reduce:animate-none`}
            >
              <div className="mb-4 flex items-center justify-between">
                <Dialog.Title className="flex items-center gap-2 font-display text-xl font-black">
                  <img
                    src="/ngertiin-mascot.webp"
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 shrink-0 object-contain"
                  />
                  <span>
                    ngerti.in<span className="text-primary">.</span>
                  </span>
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
              <nav aria-label="Navigasi utama" className="flex shrink-0 flex-col gap-0.5">
                {navigation.map(({ to, label, icon }) => {
                  const active = activeRoute === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={to === "/modules/new" ? createModuleClass : navItemClass}
                    >
                      <HugeiconsIcon
                        icon={icon}
                        size={18}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </nav>
              {isChatPage && isClerkConfigured ? <ChatSidebarSection /> : null}
              <div className="mt-auto shrink-0">
                {usage ? <div className="pb-4 pt-4">{usage}</div> : null}
                <div className="border-t pt-3">
                  <NavUser {...user} side="top" />
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>
    </>
  );
}
