import { FileText, Library, Link, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ComposerPanel } from "./composer-panel";
import { statusLabels } from "./composer-presentation";
import type { ComposerState } from "./use-composer";

export function Composer({
  state,
  library,
  statuses,
}: {
  state: ComposerState;
  library?: ReactNode;
  statuses?: ReactNode;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#module-composer") textarea.current?.focus();
  }, [hash]);
  return (
    <section id="module-composer" aria-labelledby="composer-heading" className="scroll-mt-6">
      <h2 id="composer-heading" className="sr-only">
        Buat modul belajar
      </h2>
      <Card className="gap-0 rounded-card border-input bg-card p-4 focus-within:border-primary sm:px-5">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void state.submit();
          }}
        >
          <fieldset disabled={state.busy} className="min-w-0 space-y-2">
            <label htmlFor="composer-text" className="sr-only">
              Materi belajar
            </label>
            <textarea
              ref={textarea}
              id="composer-text"
              rows={2}
              className="block min-h-12 max-h-32 w-full resize-y rounded-sm bg-transparent text-sm leading-6 placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Lagi ingin memahami apa? Tempel materi atau catatanmu di sini…"
              value={state.text}
              onChange={(event) => state.setText(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey) &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void state.submit();
                }
              }}
            />
            {state.selected.length ? (
              <ul className="space-y-2" aria-live="polite">
                {state.selected.map((item) => (
                  <li
                    key={item.source.id}
                    className="flex min-w-0 items-center gap-2 rounded-button bg-muted px-3 py-2 text-sm"
                  >
                    <FileText aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 break-words">
                      {item.source.title ?? "Materi tanpa judul"}
                      <span className="block text-caption text-muted-foreground">
                        {statusLabels[item.source.status]}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Hapus ${item.source.title ?? "materi"}`}
                      onClick={() => state.toggle(item.source)}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-1 border-t pt-2">
              {(
                [
                  ["pdf", "PDF", FileText],
                  ["url", "Tautan", Link],
                  ["library", "Materi lama", Library],
                  ["focus", "Fokus", SlidersHorizontal],
                ] as const
              ).map(([key, label, Icon]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 px-2 normal-case tracking-normal"
                  aria-expanded={state.panel === key}
                  aria-controls="composer-panel"
                  onClick={() => state.setPanel(state.panel === key ? null : key)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="link"
                className="normal-case tracking-normal"
                aria-expanded={state.panel === "manage"}
                aria-controls="composer-panel"
                onClick={() => state.setPanel(state.panel === "manage" ? null : "manage")}
              >
                Atur materi
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!!state.blocked}
                className="ml-auto normal-case tracking-normal"
              >
                <Sparkles aria-hidden="true" />
                {state.busy ? "Menyiapkan…" : "Buat modul"}
              </Button>
            </div>
            <ComposerPanel
              state={state}
              library={library}
              onClose={() => {
                state.setPanel(null);
                textarea.current?.focus();
              }}
            />
            {state.sourceError ? (
              <p role="alert" className="text-sm text-destructive">
                {state.sourceError}
              </p>
            ) : null}
            {statuses}
            <div className="pt-1">
              <p className="text-caption text-muted-foreground">
                {state.count}/10 materi <span className="hidden sm:inline">· Ctrl/Cmd + Enter</span>
              </p>
            </div>
          </fieldset>
          {state.blocked ? (
            <p className="mt-1 text-caption text-muted-foreground" role="status">
              {state.blocked}
            </p>
          ) : null}
          {state.error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </form>
      </Card>
    </section>
  );
}
