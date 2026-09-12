import {
  ArrowDown01Icon,
  ArrowRightDoubleIcon,
  ChatAdd01Icon,
  MinusSignIcon,
  SidebarRightIcon,
  SquareArrowUpRightIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { DropdownMenu as Menu, Popover } from "radix-ui";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { menuContentClassName, menuItemClassName } from "../../../components/ui/menu-styles";
import type { useModuleChat } from "../use-module-chat";
import { ChatThreadActions } from "./chat-thread-actions";

type ChatHeaderProps = {
  chat: ReturnType<typeof useModuleChat>;
  title: string;
  busy: boolean;
  onCreate: () => void;
  onFullScreen: () => void;
};

export function ChatHeader({ chat, title, busy, onCreate, onFullScreen }: ChatHeaderProps) {
  const [listOpen, setListOpen] = useState(false);
  return (
    <header className="flex shrink-0 items-center gap-0.5 px-3 py-2">
      <Popover.Root open={listOpen} onOpenChange={setListOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="mr-auto flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Riwayat percakapan"
          >
            <span className="truncate">{title}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={14}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            className={`${menuContentClassName} w-80`}
            aria-label="Riwayat percakapan"
          >
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Percakapan di modul ini
            </p>
            {chat.list.map((thread) => (
              <div
                key={thread.id}
                className={`flex items-center rounded-lg ${thread.id === chat.selectedId ? "bg-accent" : ""}`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate p-3 text-left text-xs"
                  onClick={() => {
                    chat.select(thread.id);
                    setListOpen(false);
                  }}
                >
                  {thread.title}
                </button>
                <ChatThreadActions
                  thread={thread}
                  api={chat.api}
                  root={chat.root}
                  onDeleted={() => {
                    if (thread.id === chat.selectedId) chat.select(null);
                  }}
                />
              </div>
            ))}
            {!chat.list.length ? (
              <p className="p-3 text-xs text-muted-foreground">Belum ada percakapan.</p>
            ) : null}
            {chat.threads.hasNextPage ? (
              <Button
                size="sm"
                variant="link"
                onClick={() => void chat.threads.fetchNextPage()}
                disabled={chat.threads.isFetchingNextPage}
              >
                Muat percakapan lainnya
              </Button>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg text-foreground [&_svg]:size-4"
        disabled={busy}
        onClick={onCreate}
        aria-label="Percakapan baru"
        title="Percakapan baru"
      >
        <HugeiconsIcon icon={ChatAdd01Icon} strokeWidth={1.5} aria-hidden="true" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-foreground [&_svg]:size-4"
            aria-label="Pilih layout chat"
            title="Pilih layout chat"
          >
            <HugeiconsIcon
              icon={chat.layout === "sidebar" ? SidebarRightIcon : SquareArrowUpRightIcon}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Menu.RadioGroup
            value={chat.layout}
            onValueChange={(value) => {
              if (value === "sidebar" || value === "floating") chat.setLayout(value);
            }}
          >
            {[
              { value: "sidebar", label: "Sidebar", icon: SidebarRightIcon },
              { value: "floating", label: "Overlay", icon: SquareArrowUpRightIcon },
            ].map(({ value, label, icon }) => (
              <Menu.RadioItem key={value} value={value} className={menuItemClassName}>
                <HugeiconsIcon icon={icon} size={16} strokeWidth={1.5} aria-hidden="true" />
                {label}
                <Menu.ItemIndicator className="ml-auto">
                  <HugeiconsIcon icon={Tick02Icon} size={14} aria-hidden="true" />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item disabled={busy} onSelect={onFullScreen} className={menuItemClassName}>
            <HugeiconsIcon
              icon={SquareArrowUpRightIcon}
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            Full Screen
          </Menu.Item>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg text-foreground [&_svg]:size-4"
        onClick={() => chat.toggle(false)}
        aria-label="Minimalkan chat"
        title="Minimalkan chat"
      >
        <HugeiconsIcon
          icon={chat.layout === "sidebar" ? ArrowRightDoubleIcon : MinusSignIcon}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </Button>
    </header>
  );
}
