import { useAuth } from "@clerk/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { lazy, Suspense, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useSource } from "../features/sources/api/use-sources";
import { SourceItemContent } from "../features/sources/source-item-content";
import { sourceMetadata, sourceTitle } from "../features/sources/source-presentation";
import { SourceReadingContent } from "../features/sources/source-reading-content";

const SourcePdfViewer = lazy(() => import("../features/sources/source-pdf-viewer"));

export default function SourceDetailPage() {
  const { userId } = useAuth();
  const { sourceId } = useParams();
  return <SourceDetail key={`${userId}:${sourceId}`} id={sourceId} />;
}

function SourceDetail({ id }: { id: string | undefined }) {
  const query = useSource(id);
  const [dirty, setDirty] = useState(false);
  const source = query.data;
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const back =
    typeof returnTo === "string" && /^\/sources(?:\?|$)/.test(returnTo) ? returnTo : "/sources";
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b border-muted bg-background/95 px-4 backdrop-blur sm:px-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 text-xs font-medium normal-case text-muted-foreground"
        >
          <Link
            to={back}
            onClick={(event) => {
              if (dirty && !window.confirm("Perubahan belum disimpan. Tinggalkan halaman?"))
                event.preventDefault();
            }}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.5} aria-hidden="true" />
            Kembali ke Materi saya
          </Link>
        </Button>
      </header>
      {query.isPending ? (
        <p role="status" className="p-8">
          Memuat materi…
        </p>
      ) : !source ? (
        <div role="alert" className="space-y-4 p-8">
          <p>Materi tidak ditemukan atau belum dapat dimuat.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <div className="mx-auto max-w-60 pt-4">
              <SourceItemContent
                source={source}
                compact
                actions={null}
                onPreview={() => document.getElementById("source-content")?.focus()}
              />
            </div>
            {source.archivedAt ? (
              <p className="mt-5 text-sm text-muted-foreground">Materi ini diarsipkan.</p>
            ) : null}
            {source.failure ? (
              <p role="alert" className="mt-5 text-sm text-destructive">
                {source.failure.message}
              </p>
            ) : null}
          </aside>
          <section
            id="source-content"
            tabIndex={-1}
            className="min-w-0 outline-none"
            aria-labelledby="source-title"
          >
            <header className="mb-8 space-y-3">
              <p className="text-xs text-muted-foreground">{sourceMetadata(source)}</p>
              <h1
                id="source-title"
                className="font-display text-2xl font-bold tracking-tight sm:text-3xl wrap-anywhere"
              >
                {sourceTitle(source)}
              </h1>
              {source.originalUrl ? (
                <a
                  href={source.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-link underline underline-offset-4 wrap-anywhere"
                >
                  {source.originalUrl}
                </a>
              ) : null}
            </header>
            {source.type === "pdf" ? (
              <Suspense fallback={<p role="status">Memuat pembaca PDF…</p>}>
                <SourcePdfViewer id={source.id} />
              </Suspense>
            ) : (
              <SourceReadingContent source={source} onDirtyChange={setDirty} />
            )}
          </section>
        </div>
      )}
    </main>
  );
}
