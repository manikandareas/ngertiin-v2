import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router-dom";
import { ChatMascot } from "../features/chat/components/chat-mascot";

type SidebarCreateActionsProps = {
  collapsed?: boolean;
  isChatPage: boolean;
  onNewChat?: () => void;
  onNavigate?: () => void;
};

export function SidebarCreateActions({
  collapsed = false,
  isChatPage,
  onNewChat,
  onNavigate,
}: SidebarCreateActionsProps) {
  const actions = isChatPage ? (["chat", "module"] as const) : (["module", "chat"] as const);

  return (
    <nav
      aria-label="Buat baru"
      className={`flex gap-2 ${collapsed ? "flex-col items-center" : "items-center"}`}
    >
      {actions.map((action, index) => {
        const isChat = action === "chat";
        const label = isChat ? "Chat baru" : "Buat modul";
        const showLabel = index === 0 && !collapsed;

        return (
          <Link
            key={action}
            to={isChat ? "/chat" : "/modules/new"}
            aria-label={label}
            title={showLabel ? undefined : label}
            onClick={() => {
              if (isChat) onNewChat?.();
              onNavigate?.();
            }}
            className={`flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-bold text-sidebar-foreground shadow-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-sidebar-accent/30 hover:shadow-md active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transform-none motion-reduce:transition-none ${showLabel ? "min-w-0 flex-1 px-4" : "w-12 shrink-0"}`}
          >
            {isChat ? (
              <span aria-hidden="true" className="flex size-7 shrink-0">
                <ChatMascot className="size-full" />
              </span>
            ) : (
              <HugeiconsIcon
                icon={BookOpen01Icon}
                size={21}
                strokeWidth={1.5}
                aria-hidden="true"
                className="shrink-0 text-muted-foreground"
              />
            )}
            {showLabel ? <span className="truncate">{label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
