import { useEffect, useRef, useState } from "react";
import { Document, pdfjs } from "react-pdf";
import { Button } from "../../components/ui/button";
import { useSourceFile } from "./api/use-sources";
import { SourcePdfPage } from "./source-pdf-page";
import { SourcePdfToolbar } from "./source-pdf-toolbar";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const pdfOptions = {
  cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
  standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
  wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
};

export default function SourcePdfViewer({ id, initialPage }: { id: string; initialPage?: number }) {
  const file = useSourceFile(id);
  const container = useRef<HTMLDivElement>(null);
  const pageElements = useRef(new Map<number, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(initialPage ?? 1);
  const openedCitationPage = useRef(false);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!initialPage || pages === 0 || openedCitationPage.current) return;
    const element = pageElements.current.get(initialPage);
    if (!element) return;
    openedCitationPage.current = true;
    element.scrollIntoView({ block: "start" });
    setPage(initialPage);
  }, [initialPage, pages]);
  function goTo(next: number) {
    const target = Math.max(1, Math.min(pages, next));
    setPage(target);
    pageElements.current.get(target)?.scrollIntoView({ block: "start" });
  }
  const retry = (
    <div role="alert" className="space-y-3 py-8 text-sm">
      <p>PDF belum dapat ditampilkan. Coba muat ulang dokumen.</p>
      <Button
        variant="outline"
        disabled={file.isFetching}
        onClick={() => {
          setFailed(false);
          setPages(0);
          setAttempt((value) => value + 1);
          void file.refetch();
        }}
      >
        Muat ulang PDF
      </Button>
    </div>
  );
  return (
    <div ref={container} className="relative min-w-0 bg-background">
      <section className="min-h-64 bg-background pb-24" aria-label="Dokumen PDF">
        {file.isPending ? (
          <p role="status">Memuat dokumen…</p>
        ) : file.isError ? (
          retry
        ) : width > 0 ? (
          <Document
            key={`${file.data.url}:${attempt}`}
            file={file.data.url}
            options={pdfOptions}
            loading={<p role="status">Memuat PDF…</p>}
            error={retry}
            onLoadError={() => setFailed(true)}
            onLoadSuccess={({ numPages }) => {
              setPages(numPages);
              setPage((current) => Math.min(current, numPages));
              setFailed(false);
            }}
            onItemClick={({ pageNumber }) => {
              if (pageNumber) goTo(pageNumber);
            }}
            className="space-y-8"
          >
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
              <SourcePdfPage
                key={number}
                number={number}
                width={width}
                zoom={zoom}
                register={(element) => {
                  if (element) pageElements.current.set(number, element);
                  else pageElements.current.delete(number);
                }}
                onActive={setPage}
              />
            ))}
          </Document>
        ) : null}
      </section>
      {pages > 0 && !failed && !file.isError ? (
        <SourcePdfToolbar
          page={page}
          pages={pages}
          zoom={zoom}
          onPageChange={goTo}
          onZoomChange={setZoom}
        />
      ) : null}
    </div>
  );
}
