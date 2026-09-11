import type {
  ChatContextReference,
  ChatMaterialPreview,
  ChatMaterialTarget,
  ChatPageContext,
} from "@ngertiin/contracts/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { DialogFrame } from "../../../components/ui/dialog-frame";
import type { chatApi } from "../api/chat-api";

export type SelectedChatExcerpt = {
  reference: ChatContextReference;
  title: string;
  excerpt: string;
};
export function ChatContextPicker({
  api,
  root,
  pageContext,
  onClose,
  onSelect,
  returnFocus,
}: {
  api: ReturnType<typeof chatApi>;
  root: readonly unknown[];
  pageContext: ChatPageContext;
  onClose: () => void;
  onSelect: (excerpt: SelectedChatExcerpt) => void;
  returnFocus: () => void;
}) {
  const [origin, setOrigin] = useState<"node" | "source">(
    pageContext.surface === "node" ? "node" : "source",
  );
  const [target, setTarget] = useState<ChatMaterialTarget | null>(null);
  const [start, setStart] = useState(0);
  const nodeId =
    origin === "node" && pageContext.surface === "node" ? pageContext.nodeId : undefined;
  const materials = useInfiniteQuery({
    queryKey: [...root, "materials", nodeId],
    queryFn: ({ pageParam }) => api.materials(nodeId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const preview = useQuery({
    queryKey: [...root, "preview", target, start],
    queryFn: () => api.preview(target as ChatMaterialTarget, start),
    enabled: Boolean(target),
    staleTime: 0,
  });
  return (
    <DialogFrame
      open
      title="Pilih kutipan untuk dibahas"
      description="Buka materi, lalu seleksi bagian teks yang ingin kamu tanyakan."
      onClose={onClose}
      returnFocus={returnFocus}
      className="max-w-2xl"
    >
      {target ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTarget(null);
              setStart(0);
            }}
          >
            ← Daftar materi
          </Button>
          {preview.isPending ? (
            <p role="status" className="py-8 text-sm">
              Memuat materi…
            </p>
          ) : preview.isError ? (
            <div role="alert">
              <p className="py-4 text-sm">Materi belum dapat dimuat.</p>
              <Button variant="link" onClick={() => void preview.refetch()}>
                Coba lagi
              </Button>
            </div>
          ) : preview.data ? (
            <ExcerptSelection
              key={`${JSON.stringify(target)}:${start}:${preview.data.reference.contentRevision}`}
              material={preview.data}
              onSelect={onSelect}
              onPage={setStart}
            />
          ) : null}
        </>
      ) : (
        <>
          <div className="mb-5 flex gap-2">
            {pageContext.surface === "node" ? (
              <Button
                size="sm"
                variant={origin === "node" ? "default" : "outline"}
                onClick={() => setOrigin("node")}
              >
                Materi node ini
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={origin === "source" ? "default" : "outline"}
              onClick={() => setOrigin("source")}
            >
              Sumber modul
            </Button>
          </div>
          <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
            {materials.data?.pages
              .flatMap((page) => page.items)
              .map((item) => (
                <button
                  type="button"
                  key={JSON.stringify(item.target)}
                  className="block w-full rounded-xl border p-4 text-left hover:bg-accent"
                  onClick={() => setTarget(item.target)}
                >
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.pageNumber
                      ? `Halaman ${item.pageNumber}`
                      : (item.sectionTitle ?? "Teks sumber")}
                  </span>
                </button>
              ))}
            {materials.isPending ? (
              <p role="status" className="py-4 text-sm">
                Memuat daftar…
              </p>
            ) : materials.isError ? (
              <Button variant="link" onClick={() => void materials.refetch()}>
                Coba muat daftar lagi
              </Button>
            ) : !materials.data?.pages.some((page) => page.items.length) ? (
              <p className="py-4 text-sm text-muted-foreground">
                Belum ada materi yang bisa dikutip di sini.
              </p>
            ) : null}
            {materials.hasNextPage ? (
              <Button
                variant="link"
                disabled={materials.isFetchingNextPage}
                onClick={() => void materials.fetchNextPage()}
              >
                Materi lainnya
              </Button>
            ) : null}
          </div>
        </>
      )}
    </DialogFrame>
  );
}
function ExcerptSelection({
  material,
  onSelect,
  onPage,
}: {
  material: ChatMaterialPreview;
  onSelect: (excerpt: SelectedChatExcerpt) => void;
  onPage: (start: number) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const text = material.text.slice(range.start, range.end);
  return (
    <div className="mt-4">
      <p className="mb-3 text-sm font-semibold">{material.title}</p>
      <textarea
        ref={input}
        readOnly
        defaultValue={material.text}
        aria-label="Seleksi teks untuk dikutip"
        onSelect={() => {
          if (input.current) {
            const next = { start: input.current.selectionStart, end: input.current.selectionEnd };
            setRange((current) =>
              current.start === next.start && current.end === next.end ? current : next,
            );
          }
        }}
        className="h-[38dvh] w-full resize-none rounded-xl border bg-muted/20 p-4 text-sm leading-7 focus-visible:outline-ring"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={material.reference.startCodePoint === 0}
            onClick={() => onPage(Math.max(0, material.reference.startCodePoint - 12000))}
          >
            ← Bagian sebelumnya
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={material.reference.endCodePoint >= material.totalCodePoints}
            onClick={() => onPage(material.reference.endCodePoint)}
          >
            Bagian berikutnya →
          </Button>
        </div>
        <Button
          size="sm"
          disabled={!text.trim()}
          onClick={() =>
            onSelect({
              title: material.title,
              excerpt: text,
              reference: {
                ...material.reference,
                startCodePoint:
                  material.reference.startCodePoint +
                  [...material.text.slice(0, range.start)].length,
                endCodePoint:
                  material.reference.startCodePoint + [...material.text.slice(0, range.end)].length,
              },
            })
          }
        >
          Gunakan kutipan
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {text
          ? `${[...text].length} karakter dipilih`
          : "Seleksi teks dengan mouse atau tekan lama pada ponsel."}
      </p>
    </div>
  );
}
