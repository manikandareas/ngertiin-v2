import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f3] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-2 font-bold tracking-tight" to="/dashboard">
            <span className="grid size-8 place-items-center rounded-lg bg-teal-600 text-white">
              <BookOpen aria-hidden="true" className="size-4" />
            </span>
            Ngerti.in
          </Link>
          <nav
            className="flex flex-wrap items-center justify-end gap-1 text-sm"
            aria-label="Navigasi utama"
          >
            <Button asChild variant="outline">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/modules">Modules</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/modules/new">Create Module</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/profile">Profile</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">{children}</main>
    </div>
  );
}
