import { Add01Icon, Chat01Icon, HistoryIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { patchChatSession } from "../chat-session";
import { useChatThreads } from "../use-chat-threads";

export function ChatHistoryPopover({ moduleId }: { moduleId?: string | null }) {
  const { threadId } = useParams();
  const chat = useChatThreads(moduleId);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value) setSearch("");
  };
  const query = search.trim().toLocaleLowerCase();
  const matches = chat.list.filter((thread) => thread.title.toLocaleLowerCase().includes(query));
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = chat.threads;
  useEffect(() => {
    if (open && query && hasNextPage && !isFetching && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [open, query, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);
  const newChatUrl = moduleId ? `/chat?moduleId=${encodeURIComponent(moduleId)}` : "/chat";

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-1.5 text-xs text-muted-foreground capitalize"
          aria-label="Riwayat chat"
        >
          <HugeiconsIcon
            icon={HistoryIcon}
            strokeWidth={1.5}
            className="size-3.5"
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Riwayat</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex max-h-104 w-xs flex-col overflow-hidden"
        aria-label="Riwayat chat"
      >
        <div className="relative shrink-0">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            maxLength={500}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari chat…"
            aria-label="Cari chat"
            className="h-11 border bg-muted pl-8 text-base xl:h-9 xl:text-[13px]"
          />
        </div>
        <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain py-2">
          {chat.threads.isPending ? (
            <p role="status" className="px-2.5 py-3 text-[13px] text-muted-foreground">
              Memuat percakapan…
            </p>
          ) : null}
          {chat.threads.isError ? (
            <div role="alert" className="px-2.5 py-2 text-[13px]">
              <p>Riwayat belum dapat dimuat.</p>
              <Button
                variant="link"
                size="sm"
                onClick={() =>
                  void (isFetchNextPageError ? fetchNextPage() : chat.threads.refetch())
                }
              >
                Coba lagi
              </Button>
            </div>
          ) : null}
          {matches.map((thread) => (
            <Link
              key={thread.id}
              to={`/chat/${thread.id}`}
              onClick={() => changeOpen(false)}
              aria-current={thread.id === threadId ? "page" : undefined}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground hover:[&_time]:text-current focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:[&_time]:text-current aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:[&_time]:text-current"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <HugeiconsIcon icon={Chat01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium leading-4">
                  {thread.title}
                </span>
              </span>
            </Link>
          ))}
          {!chat.threads.isPending && !chat.threads.isError && !matches.length && !hasNextPage ? (
            <p role="status" className="px-2.5 py-3 text-[13px] text-muted-foreground">
              {query ? "Tidak ada percakapan yang cocok." : "Belum ada percakapan."}
            </p>
          ) : null}
          {hasNextPage && !query ? (
            <Button
              variant="link"
              size="sm"
              className="min-h-9 px-2.5 text-[13px]"
              disabled={chat.threads.isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              Muat lainnya
            </Button>
          ) : null}
          {query && hasNextPage && !isFetchNextPageError ? (
            <p role="status" className="px-2.5 py-3 text-[13px] text-muted-foreground">
              Mencari di riwayat lainnya…
            </p>
          ) : null}
        </div>
        <div className="my-1 shrink-0 border-t" />
        <Link
          to={newChatUrl}
          onClick={() => {
            patchChatSession(client, chat.root, `new:${moduleId ?? "standalone"}`, {
              draft: "",
              attachments: [],
              mentions: [],
              document: undefined,
              excerpts: [],
              pageContext: undefined,
              contextSeeded: false,
            });
            changeOpen(false);
          }}
          className="flex min-h-11 xl:min-h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] hover:bg-accent hover:text-accent-foreground hover:[&_svg]:text-current focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:[&_svg]:text-current"
        >
          <HugeiconsIcon
            icon={Add01Icon}
            strokeWidth={1.5}
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Chat baru
        </Link>
      </PopoverContent>
    </Popover>
  );
}
