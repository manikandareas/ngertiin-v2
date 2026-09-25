import { type ReactNode, useEffect, useRef, useState } from "react";

export function ToolResultViewport({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const measure = () => {
      const overflow =
        viewport.clientHeight > 0 && viewport.scrollHeight > viewport.clientHeight + 1;
      setOverflowing(overflow);
      setFade(overflow && viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    viewport.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <section
      ref={viewportRef}
      aria-label="Hasil aktivitas"
      tabIndex={overflowing ? 0 : undefined}
      data-fade={fade}
      className="data-[fade=true]:[mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent)] ml-6 max-h-60 overflow-y-auto overscroll-contain rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div ref={contentRef} className="py-2 pr-2">
        {children}
      </div>
    </section>
  );
}
