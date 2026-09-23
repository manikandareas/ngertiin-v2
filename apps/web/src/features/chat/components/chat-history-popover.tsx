import { Chat01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";
import { History, Plus } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { patchChatSession } from "../chat-session";
import { useChatThreads } from "../use-chat-threads";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function ChatHistoryPopover({ moduleId }: { moduleId?: string | null }) {
  const { threadId } = useParams();
  const chat = useChatThreads(moduleId);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 text-muted-foreground capitalize"
          aria-label="Riwayat chat"
        >
          <History className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Riwayat</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 flex w-80 max-w-[calc(100vw-24px)] max-h-[min(30rem,var(--radix-popover-content-available-height))] flex-col rounded-xl border bg-popover p-4 text-popover-foreground shadow-md"
          aria-label="Riwayat chat"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold">Riwayat Chat</h2>
            <Button size="icon" asChild className="size-8 shrink-0 rounded-lg" title="Chat baru">
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
                  setOpen(false);
                }}
                aria-label="Chat baru"
              >
                <Plus className="size-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="relative mb-3 shrink-0">
            <HugeiconsIcon
              icon={Search01Icon}
              size={18}
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari chat..."
              aria-label="Cari chat"
              className="h-9 rounded-lg border pl-10 text-sm focus-visible:outline-1 focus-visible:outline-offset-0"
            />
          </div>
          <div className="min-h-16 overflow-y-auto overscroll-contain">
            {chat.threads.isPending ? (
              <p role="status" className="px-2 py-3 text-sm text-muted-foreground">
                Memuat percakapan…
              </p>
            ) : null}
            {chat.threads.isError ? (
              <div role="alert" className="px-2 py-3 text-sm">
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
                onClick={() => setOpen(false)}
                aria-current={thread.id === threadId ? "page" : undefined}
                className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-accent"
              >
                <HugeiconsIcon
                  icon={Chat01Icon}
                  size={18}
                  strokeWidth={1.5}
                  className="shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{thread.title}</span>
                  <time dateTime={thread.updatedAt} className="block text-xs text-muted-foreground">
                    {dateFormat.format(new Date(thread.updatedAt))}
                  </time>
                </span>
              </Link>
            ))}
            {!chat.threads.isPending && !chat.threads.isError && !matches.length && !hasNextPage ? (
              <p role="status" className="px-2 py-3 text-sm text-muted-foreground">
                {query ? "Tidak ada percakapan yang cocok." : "Belum ada percakapan."}
              </p>
            ) : null}
            {hasNextPage && !query ? (
              <Button
                variant="link"
                size="sm"
                disabled={chat.threads.isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                Muat lainnya
              </Button>
            ) : null}
            {query && hasNextPage && !isFetchNextPageError ? (
              <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
                Mencari di riwayat lainnya…
              </p>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
