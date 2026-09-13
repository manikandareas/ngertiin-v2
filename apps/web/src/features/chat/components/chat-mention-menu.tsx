import type { ChatMention } from "@ngertiin/contracts/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { getJourney, listModules, type TokenResolver } from "../../../lib/api";

export type MentionMenuHandle = { keyDown: (event: KeyboardEvent) => boolean };
type ChatMentionMenuProps = {
  query: string;
  module?: ChatMention;
  getToken: TokenResolver;
  root: readonly unknown[];
  onSelect: (mention: ChatMention) => void;
  onClose: () => void;
  onActiveOption: (id: string | null) => void;
  id: string;
  ref: Ref<MentionMenuHandle>;
};

export function ChatMentionMenu({
  query,
  module,
  getToken,
  root,
  onSelect,
  onClose,
  onActiveOption,
  id,
  ref,
}: ChatMentionMenuProps) {
  const [selected, setSelected] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const modules = useInfiniteQuery({
    queryKey: [...root, "mention-modules", "ready", query],
    queryFn: ({ pageParam }) =>
      listModules(getToken, {
        q: query || undefined,
        status: "ready",
        limit: 20,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: !module,
    staleTime: 30_000,
  });
  const journey = useQuery({
    queryKey: [...root, "mention-nodes", module?.moduleId],
    queryFn: () => getJourney(getToken, module?.moduleId ?? ""),
    enabled: Boolean(module),
    staleTime: 30_000,
  });
  const items: { mention: ChatMention; title: string }[] = module
    ? (journey.data?.nodes ?? [])
        .filter(
          (node) =>
            ["lesson", "flashcard"].includes(node.type) &&
            node.progress.status !== "locked" &&
            node.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        )
        .map((node) => ({
          title: node.title,
          mention: {
            moduleId: module.moduleId,
            nodeId: node.id,
            label: `${module.label.slice(0, 120)}:${node.title.slice(0, 119)}`,
          },
        }))
    : [
        ...new Map(
          modules.data?.pages.flatMap((page) => page.data).map((item) => [item.id, item]),
        ).values(),
      ]
        .filter((item) => item.status === "ready")
        .map((item) => ({
          title: item.title ?? "Modul belajar",
          mention: { moduleId: item.id, label: (item.title ?? "Modul belajar").slice(0, 240) },
        }));
  const current = Math.min(selected, Math.max(0, items.length - 1));
  const hasItems = items.length > 0;
  useEffect(() => {
    onActiveOption(hasItems ? `${id}-${current}` : null);
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current, hasItems, id, onActiveOption]);
  useImperativeHandle(ref, () => ({
    keyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return true;
      }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        setSelected(
          (value) =>
            (value + (event.key === "ArrowDown" ? 1 : -1) + Math.max(1, items.length)) %
            Math.max(1, items.length),
        );
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (items[current]) onSelect(items[current].mention);
        return true;
      }
      return false;
    },
  }));
  const source = module ? journey : modules;
  return (
    <div className="rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
      <div className="px-2.5 py-2 text-xs text-muted-foreground">
        {module ? `Materi · ${module.label}` : "Modul kamu"}
      </div>
      <div
        ref={list}
        id={id}
        role="listbox"
        aria-label={module ? "Pilih materi" : "Pilih modul"}
        className="max-h-[min(16rem,35dvh)] overflow-y-auto"
      >
        {items.map((item, index) => (
          <button
            key={`${item.mention.moduleId}:${item.mention.nodeId ?? ""}`}
            type="button"
            role="option"
            aria-selected={index === current}
            data-index={index}
            id={`${id}-${index}`}
            tabIndex={-1}
            className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm ${index === current ? "bg-accent" : "hover:bg-accent/60"}`}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setSelected(index)}
            onClick={() => onSelect(item.mention)}
          >
            <span className="shrink-0 text-muted-foreground">{module ? "↳" : "@"}</span>
            <span className="truncate">{item.title}</span>
          </button>
        ))}
        {source.isPending ? (
          <p role="status" className="p-3 text-sm text-muted-foreground">
            Memuat…
          </p>
        ) : null}
        {source.isError ? (
          <button type="button" className="p-3 text-sm" onClick={() => void source.refetch()}>
            Gagal memuat. Coba lagi
          </button>
        ) : null}
        {!source.isPending && !source.isError && !items.length ? (
          <p className="p-3 text-sm text-muted-foreground">
            {module
              ? "Belum ada materi yang cocok dan dapat diakses."
              : "Tidak ada modul yang cocok."}
          </p>
        ) : null}
        {!module && modules.hasNextPage ? (
          <button
            type="button"
            className="w-full p-2 text-xs text-muted-foreground"
            disabled={modules.isFetchingNextPage}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void modules.fetchNextPage()}
          >
            Muat modul lainnya
          </button>
        ) : null}
      </div>
      <div className="mt-1 border-t px-2.5 py-2 text-[11px] text-muted-foreground">
        {module ? "Enter untuk pilih materi" : "Pilih modul, lalu ketik : untuk pilih materi"}
      </div>
    </div>
  );
}
