import { BookOpen01Icon, Chat01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import { ChatMascot } from "../features/chat/components/chat-mascot";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type SidebarCreateMenuProps = {
  collapsed?: boolean;
  onNewChat?: () => void;
  onNavigate?: () => void;
};

export function SidebarCreateMenu({
  collapsed = false,
  onNewChat,
  onNavigate,
}: SidebarCreateMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          type="button"
          aria-label="Buat baru"
          title={collapsed ? "Buat baru" : undefined}
          className={`h-12 w-full gap-2 rounded-button text-sm font-extrabold normal-case text-foreground data-[state=open]:bg-accent [&_svg]:size-full ${collapsed ? "justify-center px-0" : "justify-start px-3"}`}
        >
          <span aria-hidden="true" className="flex size-8 shrink-0">
            <ChatMascot className="size-full" />
          </span>
          {!collapsed ? (
            <>
              <span className="flex-1 text-left">Buat baru</span>
              <span className="size-4 text-muted-foreground" aria-hidden="true">
                <ChevronUp />
              </span>
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-72 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuItem asChild>
          <Link to="/modules/new" onClick={onNavigate} className="items-start gap-3 py-3">
            <HugeiconsIcon
              icon={BookOpen01Icon}
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="block font-medium">Modul belajar</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Susun materi jadi modul belajar.
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/chat"
            onClick={() => {
              onNewChat?.();
              onNavigate?.();
            }}
            className="items-start gap-3 py-3"
          >
            <HugeiconsIcon
              icon={Chat01Icon}
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="block font-medium">Percakapan baru</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Mulai ngobrol dengan teman belajar.
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
