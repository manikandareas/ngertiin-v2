import {
  BookOpen01Icon,
  ChampionIcon,
  Chat01Icon,
  Home01Icon,
  LibraryIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { isClerkConfigured } from "../config";
import { ChatSidebarSection } from "../features/chat/components/chat-sidebar-section";
import { SidebarCreateActions } from "./sidebar-create-actions";

const navigation = [
  { to: "/modules", label: "Modul belajar", icon: BookOpen01Icon },
  { to: "/sources", label: "Pustaka saya", icon: LibraryIcon },
  { to: "/leaderboard", label: "Leaderboard", icon: ChampionIcon },
];
const modes = [
  { to: "/dashboard", label: "Home", icon: Home01Icon },
  { to: "/chat", label: "Chat", icon: Chat01Icon },
];
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const navItemClass = `relative flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/50 aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:[&_.nav-title]:underline aria-[current=page]:[&_.nav-title]:decoration-sidebar-accent aria-[current=page]:[&_.nav-title]:decoration-4 aria-[current=page]:[&_.nav-title]:underline-offset-2 motion-reduce:transition-none ${focus}`;

export function SidebarContent({
  collapsed = false,
  usageBanner,
  onNewChat,
  onNavigate,
}: {
  usageBanner?: ReactNode;
  onNewChat?: () => void;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const isChatPage = pathname === "/chat" || pathname.startsWith("/chat/");
  return (
    <>
      <nav
        aria-label="Mode navigasi"
        className={`flex shrink-0 pb-4 pt-1 ${collapsed ? "flex-col items-center gap-1 px-2" : "items-center gap-4 px-5"}`}
      >
        {modes.map(({ to, label, icon }) => {
          const active = (to === "/chat") === isChatPage;
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              aria-current={active ? "location" : undefined}
              title={label}
              aria-label={label}
              className={`relative flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-sidebar-foreground aria-[current=location]:text-sidebar-accent-foreground motion-reduce:transition-none ${collapsed ? "w-12 rounded-lg aria-[current=location]:bg-sidebar-accent" : "px-1 after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:-rotate-3 after:rounded-[50%] after:border-b-2 after:border-transparent aria-[current=location]:after:border-primary"} ${focus}`}
            >
              <HugeiconsIcon icon={icon} size={18} strokeWidth={1.5} aria-hidden="true" />
              {!collapsed ? <span>{label}</span> : null}
            </Link>
          );
        })}
      </nav>
      {isChatPage && !collapsed ? (
        <SidebarChatHistory />
      ) : (
        <nav
          aria-label="Navigasi utama"
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${collapsed ? "px-2" : "px-5"}`}
        >
          {!collapsed ? (
            <div className="flex shrink-0 items-center pb-1">
              <h2 className="flex h-9 items-center text-xs font-semibold text-muted-foreground">
                Ruang belajar
              </h2>
            </div>
          ) : null}
          {navigation.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              aria-current={pathname === to || pathname.startsWith(`${to}/`) ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`${navItemClass} ${collapsed ? "justify-center rounded-lg aria-[current=page]:bg-sidebar-accent" : "px-2"}`}
            >
              <HugeiconsIcon
                icon={icon}
                size={18}
                strokeWidth={1.5}
                aria-hidden="true"
                className="shrink-0"
              />
              <span className={collapsed ? "sr-only" : "nav-title truncate"}>{label}</span>
            </Link>
          ))}
        </nav>
      )}
      <div className={`mt-auto shrink-0 space-y-3 py-4 ${collapsed ? "px-2" : "px-5"}`}>
        {!collapsed ? usageBanner : null}
        <SidebarCreateActions
          collapsed={collapsed}
          isChatPage={isChatPage}
          onNewChat={onNewChat}
          onNavigate={onNavigate}
        />
      </div>
    </>
  );
}

function SidebarChatHistory() {
  if (!isClerkConfigured) return <div className="min-h-0 flex-1" />;
  return <ChatSidebarSection />;
}
