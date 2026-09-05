import { UserButton } from "@clerk/react";
import { BookOpen, House, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ThemeSelect } from "./theme-select";

const navigation = [
  { to: "/dashboard", label: "Beranda", icon: House },
  { to: "/modules", label: "Modul", icon: BookOpen },
  { to: "/profile", label: "Profil", icon: UserRound },
];

export function AppShell({
  children,
  account = <UserButton />,
}: {
  children: ReactNode;
  account?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-300 flex-wrap items-center justify-between gap-x-8 px-5 sm:px-8">
          <Link to="/dashboard" className="py-4 font-display text-3xl font-black tracking-tight">
            ngerti.in<span className="text-primary">.</span>
          </Link>
          <nav
            aria-label="Navigasi utama"
            className="order-3 flex w-full justify-center gap-7 sm:order-none sm:w-auto sm:flex-1 sm:justify-start"
          >
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to !== "/modules"}
                className={({ isActive }) =>
                  `flex min-h-14 items-center gap-2 border-b-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-ring ${isActive ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`
                }
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeSelect />
            {account}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8 lg:py-16">{children}</main>
    </div>
  );
}
