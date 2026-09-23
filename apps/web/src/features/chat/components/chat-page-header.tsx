import { useUser } from "@clerk/react";
import { Chat01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { UserAvatar } from "../../../components/user-avatar";
import { useCurrentUser } from "../../current-user/api/use-current-user";
import { ChatHistoryPopover } from "./chat-history-popover";

type ChatPageHeaderProps = {
  title: string;
  moduleId?: string | null;
  moduleTitle?: string;
  actions?: ReactNode;
};

export function ChatPageHeader({ title, moduleId, moduleTitle, actions }: ChatPageHeaderProps) {
  const { user: clerkUser } = useUser();
  const currentUser = useCurrentUser();
  const userName = currentUser.data?.displayName || clerkUser?.fullName || "Akun belajar";
  const avatarUrl = currentUser.data?.avatarUrl || clerkUser?.imageUrl;

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-1 border-b border-border bg-background px-4 py-2.5 sm:gap-2 sm:px-6 xl:pointer-events-none xl:border-b-0 xl:bg-transparent">
      <button
        type="button"
        aria-label="Buka menu navigasi"
        onClick={() => window.dispatchEvent(new Event("ngertiin:open-mobile-sidebar"))}
        className="pointer-events-auto grid size-9 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:hidden"
      >
        {avatarUrl ? (
          <UserAvatar avatarUrl={avatarUrl} name={userName} className="size-8 rounded-lg" />
        ) : (
          <span className="grid size-8 place-items-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
            {userName[0]?.toLocaleUpperCase("id-ID")}
          </span>
        )}
      </button>
      <div className="pointer-events-auto flex min-h-10 min-w-0 items-center gap-1.5 rounded-lg xl:bg-background xl:px-2 xl:py-1">
        {moduleId ? (
          <>
            <span
              className="max-w-[min(28vw,16rem)] truncate text-sm text-muted-foreground"
              title={moduleTitle}
            >
              {moduleTitle ?? "Modul belajar"}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </>
        ) : null}
        <HugeiconsIcon
          icon={Chat01Icon}
          size={18}
          strokeWidth={1.5}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        <h1 className="min-w-0 truncate text-sm font-medium max-w-[min(28vw,16rem)]" title={title}>
          {title}
        </h1>
        {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
      </div>
      <div className="pointer-events-auto ml-auto flex shrink-0 items-center rounded-lg xl:bg-background">
        <ChatHistoryPopover moduleId={moduleId} />
      </div>
    </header>
  );
}
