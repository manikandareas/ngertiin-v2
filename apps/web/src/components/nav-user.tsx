import { LogOut, Settings } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { UserAvatar } from "./user-avatar";

export type NavUserProps = {
  name: string;
  email?: string;
  avatarUrl?: string;
  onLogout?: () => Promise<void>;
  collapsed?: boolean;
  unsavedChanges?: boolean;
  side?: "right" | "top";
};

export function NavUser({
  name,
  avatarUrl,
  onLogout,
  collapsed = false,
  unsavedChanges = false,
  side = "right",
}: NavUserProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const avatar = avatarUrl ? (
    <UserAvatar avatarUrl={avatarUrl} name={name} className="size-8 rounded-lg" />
  ) : (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted font-bold text-muted-foreground"
    >
      {Array.from(name.trim() || "?")[0]?.toLocaleUpperCase("id-ID")}
    </span>
  );
  const identity = (
    <div className="min-w-0 flex-1 text-left">
      <p className="truncate text-sm font-semibold" title={name}>
        {name}
      </p>
    </div>
  );

  async function logout(): Promise<void> {
    if (!onLogout || signingOut) return;
    setSigningOut(true);
    setLogoutError(false);
    try {
      await onLogout();
      setConfirmLogout(false);
    } catch {
      setLogoutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Menu akun ${name}`}
          title={collapsed ? name : undefined}
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-lg p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
            collapsed && "justify-center px-0",
          )}
        >
          {avatar}
          {!collapsed && identity}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-64"
        onCloseAutoFocus={(event) => {
          if (confirmLogout) event.preventDefault();
        }}
      >
        <DropdownMenuLabel className="flex items-center gap-3 font-normal">
          {avatar}
          {identity}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings aria-hidden="true" />
            Pengaturan
          </Link>
        </DropdownMenuItem>
        <ThemeToggle variant="menu" />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!onLogout || signingOut}
          onSelect={() => {
            setLogoutError(false);
            setConfirmLogout(true);
          }}
        >
          <LogOut aria-hidden="true" />
          {signingOut ? "Keluar…" : "Keluar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <AlertDialog.Root
        open={confirmLogout}
        onOpenChange={(open) => {
          if (!signingOut) setConfirmLogout(open);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-60 bg-black/40" />
          <AlertDialog.Content
            className="fixed left-1/2 top-1/2 z-61 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border bg-background p-6 text-foreground shadow-xl motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus();
            }}
            onEscapeKeyDown={(event) => {
              if (signingOut) event.preventDefault();
            }}
            aria-busy={signingOut}
          >
            <AlertDialog.Title className="font-display text-xl font-bold">
              Keluar dari akun?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              {unsavedChanges ? "Perubahan form belum disimpan dan akan hilang saat keluar. " : ""}
              Kamu perlu masuk kembali untuk melanjutkan belajar.
            </AlertDialog.Description>
            {logoutError && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                Belum berhasil keluar. Coba lagi, ya.
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="ghost" disabled={signingOut}>
                  Batal
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  disabled={signingOut}
                  onClick={(event) => {
                    event.preventDefault();
                    void logout();
                  }}
                  variant="destructive"
                >
                  {signingOut ? "Keluar…" : "Ya, keluar"}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </DropdownMenu>
  );
}
