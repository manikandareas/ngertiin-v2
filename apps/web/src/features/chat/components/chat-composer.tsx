import { ArrowUp02Icon, Book02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { cn } from "../../../lib/utils";
import { CHAT_AGENT_NAME } from "../constants";

type ChatComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  contextLabel?: string;
  className?: string;
  disabled?: boolean;
  fullPage?: boolean;
  active?: boolean;
  cancelling?: boolean;
  onCancel?: () => void;
  attachments?: ReactNode;
  attachAction?: ReactNode;
};

export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  contextLabel,
  className,
  disabled,
  fullPage = false,
  active = false,
  cancelling = false,
  onCancel,
  attachments,
  attachAction,
}: ChatComposerProps) {
  const canSend = Boolean(draft.trim()) && !disabled && !active;

  return (
    <form
      className={cn("shrink-0 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <div
        className={
          fullPage
            ? "rounded-card border border-input/60 bg-background p-3 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring"
            : "rounded-card border bg-muted p-2.5 focus-within:border-input"
        }
      >
        {contextLabel ? (
          <div
            className="inline-flex max-w-[min(75%,15rem)] items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] text-muted-foreground"
            title={contextLabel}
          >
            <HugeiconsIcon
              icon={Book02Icon}
              size={14}
              strokeWidth={1.5}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate">{contextLabel}</span>
          </div>
        ) : null}
        {attachments}
        <Textarea
          aria-label={`Pesan untuk ${CHAT_AGENT_NAME}`}
          placeholder="Tanyakan yang belum kamu pahami…"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          rows={2}
          className={cn(
            "resize-none border-0 bg-transparent px-0.5 py-2 shadow-none focus-visible:outline-none focus-visible:ring-0",
            fullPage ? "max-h-48 min-h-16 text-base" : "max-h-32 min-h-14 text-sm",
          )}
        />
        <div className="flex items-center justify-between gap-2">
          {attachAction ?? (
            <span className="text-[10px] text-muted-foreground">
              {contextLabel ? "Percakapan dalam modul ini" : "Tanyakan apa yang ingin kamu pahami"}
            </span>
          )}
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs normal-case"
              onClick={onCancel}
              disabled={cancelling}
            >
              Hentikan
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className={cn(
                "rounded-full shadow-none disabled:text-muted-foreground",
                fullPage ? "size-10 disabled:bg-muted" : "size-8 disabled:bg-border",
              )}
              aria-label="Kirim pesan"
              disabled={!canSend}
            >
              <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={1.8} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
