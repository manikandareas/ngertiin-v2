import { ArrowUp02Icon, Book02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { CHAT_AGENT_NAME } from "../constants";

type ChatComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  contextLabel: string;
  disabled?: boolean;
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
  disabled,
  active = false,
  cancelling = false,
  onCancel,
  attachments,
  attachAction,
}: ChatComposerProps) {
  const canSend = Boolean(draft.trim()) && !disabled && !active;

  return (
    <form
      className="shrink-0 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <div className="rounded-card border bg-muted p-2.5 focus-within:border-input">
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
          className="max-h-32 min-h-14 resize-none border-0 bg-transparent px-0.5 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2">
          {attachAction ?? (
            <span className="text-[10px] text-muted-foreground">Percakapan dalam modul ini</span>
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
              className="size-8 rounded-full shadow-none disabled:bg-border disabled:text-muted-foreground"
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
