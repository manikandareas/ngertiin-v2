import { useClerk, useUser } from "@clerk/react";
import { SidebarLeftIcon, SidebarRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { patchChatSession } from "../features/chat/chat-session";
import { useCurrentUser } from "../features/current-user/api/use-current-user";
import { UsageBanner } from "../features/usage/usage-banner";
import { useUsageSync } from "../features/usage/use-usage-sync";
import { NavUser, type NavUserProps } from "./nav-user";
import { SidebarContent } from "./sidebar-content";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ConnectedAppSidebar({ unsavedChanges = false }: { unsavedChanges?: boolean }) {
  useUsageSync();
  const client = useQueryClient();
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
      onNewChat={() =>
        patchChatSession(client, ["chat", clerkUser?.id], "new:standalone", {
          draft: "",
          excerpts: [],
          pageContext: undefined,
        })
      }
    />
  );
}

type AppSidebarProps = {
  user?: Omit<NavUserProps, "collapsed" | "side">;
  usageBanner?: ReactNode;
  onNewChat?: () => void;
};

export function AppSidebar({
  user = { name: "Akun belajar" },
  usageBanner,
  onNewChat,
}: AppSidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
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
  return (
    <>
      <aside
        aria-label="Sidebar"
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground xl:flex ${collapsed ? "w-16" : "w-64"}`}
      >
        <div
          className={`flex shrink-0 items-center gap-2 py-3 ${collapsed ? "flex-col px-2" : "px-3"}`}
        >
          <div className={collapsed ? "w-full" : "min-w-0 flex-1"}>
            <NavUser {...user} collapsed={collapsed} />
          </div>
          <button
            type="button"
            aria-label={collapsed ? "Perluas sidebar" : "Kecilkan sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted ${focus}`}
          >
            <HugeiconsIcon
              icon={collapsed ? SidebarRightIcon : SidebarLeftIcon}
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
        </div>
        <SidebarContent collapsed={collapsed} usageBanner={usageBanner} onNewChat={onNewChat} />
      </aside>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2 xl:hidden">
        <div className="min-w-0 max-w-64 flex-1">
          <NavUser {...user} side="bottom" />
        </div>
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Buka menu navigasi"
              className={`grid size-11 shrink-0 place-items-center rounded-lg hover:bg-sidebar-accent/50 ${focus}`}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[calc(100%-2rem)] flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left duration-200 motion-reduce:animate-none"
            >
              <Dialog.Title className="sr-only">Navigasi ngerti.in</Dialog.Title>
              <div className="flex shrink-0 items-center gap-2 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <NavUser {...user} side="bottom" />
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Tutup menu"
                    className={`grid size-11 shrink-0 place-items-center rounded-lg hover:bg-sidebar-accent/50 ${focus}`}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <SidebarContent
                usageBanner={usageBanner}
                onNewChat={onNewChat}
                onNavigate={() => setMenuOpen(false)}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>
    </>
  );
}
