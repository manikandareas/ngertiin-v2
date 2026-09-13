import { Chat01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useChatThreads } from "../use-chat-threads";
import { ChatNewButton } from "./chat-new-button";
import { ChatThreadActions } from "./chat-thread-actions";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function ChatSidebarSection({ collapsed = false }: { collapsed?: boolean }) {
  const chat = useChatThreads();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchButton = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const query = search.trim().toLocaleLowerCase();
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = chat.threads;
  useEffect(() => {
    if (query && hasNextPage && !isFetching && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [query, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);
  useEffect(() => {
    if (searchOpen && !collapsed) input.current?.focus();
  }, [searchOpen, collapsed]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const matches = chat.list.filter((thread) => thread.title.toLocaleLowerCase().includes(query));
  const groups = [
    {
      label: "Today",
      threads: matches.filter((thread) => new Date(thread.updatedAt).getTime() >= today),
    },
    {
      label: "Older",
      threads: matches.filter((thread) => new Date(thread.updatedAt).getTime() < today),
    },
  ];
  function closeSearch() {
    setSearchOpen(false);
    setSearch("");
    searchButton.current?.querySelector("button")?.focus();
  }
  return (
    <section
      aria-label="Percakapan Chat"
      className={`flex min-h-0 flex-1 flex-col ${collapsed ? "items-center px-2" : "px-5"}`}
    >
      {collapsed ? (
        <ChatNewButton iconOnly />
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between pb-2">
            <h2 className="flex h-9 items-center text-xs font-semibold text-muted-foreground">
              Today
            </h2>
            <div className="flex items-center">
              <span ref={searchButton}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full text-muted-foreground"
                  title="Cari percakapan"
                  aria-label="Cari percakapan"
                  aria-expanded={searchOpen}
                  onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                >
                  <HugeiconsIcon
                    icon={Search01Icon}
                    size={18}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </Button>
              </span>
              <ChatNewButton iconOnly />
            </div>
          </div>
          {searchOpen ? (
            <div className="relative mb-3 shrink-0">
              <Input
                ref={input}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeSearch();
                }}
                placeholder="Cari percakapan…"
                aria-label="Cari judul percakapan"
                className="h-9 border px-3 pr-9 text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 size-9"
                aria-label="Tutup pencarian"
                onClick={closeSearch}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {chat.threads.isPending ? (
              <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
                Memuat percakapan…
              </p>
            ) : null}
            {chat.threads.isError ? (
              <div role="alert" className="px-2 py-3 text-xs">
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
            {groups.map((group) => (
              <div key={group.label}>
                {group.label === "Today" &&
                !group.threads.length &&
                !query &&
                !chat.threads.isPending &&
                !chat.threads.isError ? (
                  <p
                    role="status"
                    className="px-1 py-3 text-xs leading-relaxed text-muted-foreground"
                  >
                    Belum ada percakapan hari ini. Mulai lewat tombol + di atas.
                  </p>
                ) : null}
                {group.label === "Older" && group.threads.length ? (
                  <h2 className="mb-2 mt-5 text-xs font-semibold text-muted-foreground">Older</h2>
                ) : null}
                {group.threads.map((thread) => {
                  const updated = new Date(thread.updatedAt);
                  const minutes = Math.max(
                    1,
                    Math.floor((now.getTime() - updated.getTime()) / 60000),
                  );
                  const time =
                    group.label === "Today"
                      ? minutes < 60
                        ? `${minutes}m`
                        : `${Math.floor(minutes / 60)}h`
                      : dateFormat.format(updated);
                  return (
                    <div
                      key={thread.id}
                      className="group relative flex min-w-0 items-center hover:bg-muted"
                    >
                      <Link
                        to={`/chat/${thread.id}`}
                        title={thread.title}
                        aria-current={thread.id === threadId ? "page" : undefined}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-1 py-3 text-sm aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:[&_.thread-title]:underline aria-[current=page]:[&_.thread-title]:decoration-sidebar-accent aria-[current=page]:[&_.thread-title]:decoration-4 aria-[current=page]:[&_.thread-title]:underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <HugeiconsIcon
                          icon={Chat01Icon}
                          size={18}
                          strokeWidth={1.5}
                          className="size-[18px] shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="thread-title block truncate">{thread.title}</span>
                          {thread.activeRunId ? (
                            <span className="block text-[10px] text-muted-foreground">
                              Sedang menjawab…
                            </span>
                          ) : null}
                        </span>
                        <time
                          dateTime={thread.updatedAt}
                          title={updated.toLocaleString()}
                          className="shrink-0 text-[11px] text-muted-foreground xl:group-hover:invisible xl:group-focus-within:invisible"
                        >
                          {time}
                        </time>
                      </Link>
                      <div className="shrink-0 xl:absolute xl:right-1 xl:opacity-0 xl:focus-within:opacity-100 xl:group-hover:opacity-100">
                        <ChatThreadActions
                          thread={thread}
                          api={chat.api}
                          root={chat.root}
                          onDeleted={() => {
                            if (thread.id === threadId) navigate("/chat", { replace: true });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {!chat.threads.isPending &&
            !chat.threads.isError &&
            !matches.length &&
            query &&
            !hasNextPage ? (
              <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
                Tidak ada percakapan yang cocok.
              </p>
            ) : null}
            {query && hasNextPage && !isFetchNextPageError ? (
              <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
                Mencari di riwayat lainnya…
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
          </div>
        </>
      )}
    </section>
  );
}
