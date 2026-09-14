import { useEffect, useRef, useState } from "react";
import { Page } from "react-pdf";

export function SourcePdfPage({
  number,
  width,
  zoom,
  register,
  onActive,
}: {
  number: number;
  width: number;
  zoom: number;
  register: (element: HTMLElement | null) => void;
  onActive: (page: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(false);
  const [ratio, setRatio] = useState(297 / 210);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const renderObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry) setNearby(entry.isIntersecting);
      },
      { rootMargin: "1000px 0px" },
    );
    const activeObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onActive(number);
      },
      {
        rootMargin: `-${Math.round(window.innerHeight * 0.15)}px 0px -${Math.round(window.innerHeight * 0.75)}px 0px`,
      },
    );
    renderObserver.observe(node);
    activeObserver.observe(node);
    return () => {
      renderObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [number, onActive]);
  return (
    <div
      ref={(node) => {
        element.current = node;
        register(node);
      }}
      data-citation-page={number}
      className="scroll-mt-20"
    >
      <div className="mb-3 flex items-center gap-3 text-[10px] font-semibold tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border/50" />
        <span>HALAMAN {number}</span>
        <span className="h-px flex-1 bg-border/50" />
      </div>
      <div className="overflow-x-auto" style={{ minHeight: width * zoom * ratio }}>
        {nearby ? (
          <Page
            pageNumber={number}
            width={width}
            scale={zoom}
            devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
            onLoadSuccess={(page) => {
              const viewport = page.getViewport({ scale: 1 });
              setRatio(viewport.height / viewport.width);
            }}
            loading={
              <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                Memuat halaman {number}…
              </p>
            }
            error={
              <p role="alert" className="py-8 text-center text-sm text-destructive">
                Halaman {number} belum dapat ditampilkan.
              </p>
            }
            className="mx-auto w-fit"
          />
        ) : null}
      </div>
    </div>
  );
}
