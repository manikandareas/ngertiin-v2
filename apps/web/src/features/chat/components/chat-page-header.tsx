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
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-background px-4 py-1 sm:gap-1.5 sm:px-6 xl:border-b-0">
      <button
        type="button"
        aria-label="Buka menu navigasi"
        onClick={() => window.dispatchEvent(new Event("ngertiin:open-mobile-sidebar"))}
        className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:hidden"
      >
        {avatarUrl ? (
          <UserAvatar avatarUrl={avatarUrl} name={userName} className="size-6 rounded-md" />
        ) : (
          <span className="grid size-6 place-items-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
            {userName[0]?.toLocaleUpperCase("id-ID")}
          </span>
        )}
      </button>
      <div className="flex min-h-8 min-w-0 items-center gap-1 rounded-lg xl:px-1">
        {moduleId ? (
          <>
            <span
              className="max-w-[min(28vw,16rem)] truncate text-[13px] text-muted-foreground"
              title={moduleTitle}
            >
              {moduleTitle ?? "Modul belajar"}
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </>
        ) : null}
        <HugeiconsIcon
          icon={Chat01Icon}
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        <h1
          className="min-w-0 truncate text-[13px] font-medium max-w-[min(28vw,16rem)]"
          title={title}
        >
          {title}
        </h1>
        {actions ? (
          <div className="flex shrink-0 items-center [&_button]:size-7 [&_svg]:size-3.5">
            {actions}
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex shrink-0 items-center rounded-lg">
        <ChatHistoryPopover moduleId={moduleId} />
      </div>
    </header>
  );
}
