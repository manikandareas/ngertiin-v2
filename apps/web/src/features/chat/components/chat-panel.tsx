import { Dialog } from "radix-ui";
import {
  Activity,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { CHAT_AGENT_NAME } from "../constants";
import type { ChatLayout } from "../use-module-chat";
import { ChatMascot } from "./chat-mascot";

// A single content tree keeps drafts and the transport alive across layout changes.
// Activity preserves state while minimized and suspends hidden effects/subscriptions.
type ChatPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: ChatLayout;
  children: ReactNode;
};

export function ChatPanel({ open, onOpenChange, layout, children }: ChatPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const [width, setWidth] = useState(420);
  const [maxWidth, setMaxWidth] = useState(720);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const visibleWidth = Math.min(width, maxWidth);
  const clampWidth = (value: number) => Math.max(320, Math.min(maxWidth, value));
  useEffect(() => {
    if (!open || layout !== "sidebar") return;
    const container = panel.current?.parentElement;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      // Reserve at least 320px for the learning content on desktop.
      setMaxWidth(Math.max(320, Math.min(720, container.clientWidth - 320)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [open, layout]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      {!open ? (
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          size="icon"
          className="group/chat-trigger fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 size-16 rounded-full border bg-card text-foreground shadow-[0_4px_0_var(--border),0_10px_25px_#00000012] hover:bg-card motion-safe:hover:-translate-y-1 [&_svg]:size-full"
          aria-label={`Buka ${CHAT_AGENT_NAME}`}
          aria-expanded={false}
          aria-controls="learning-chat-panel"
          onClick={() => onOpenChange(true)}
        >
          <ChatMascot className="size-16" />
          <span className="pointer-events-none absolute right-19 whitespace-nowrap rounded-xl border bg-popover px-3 py-2 text-xs font-semibold normal-case text-popover-foreground opacity-0 shadow-sm group-hover/chat-trigger:opacity-100 group-focus-visible/chat-trigger:opacity-100">
            Ada yang bikin penasaran?
          </span>
        </Button>
      ) : null}
      <Activity mode={open ? "visible" : "hidden"}>
        <Dialog.Content
          forceMount
          ref={panel}
          id="learning-chat-panel"
          aria-describedby={undefined}
          style={{ "--chat-sidebar-width": `${visibleWidth}px` } as CSSProperties}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (
              panel.current?.querySelector<HTMLElement>('[role="textbox"]') ?? panel.current
            )?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(triggerId)?.focus();
          }}
          className={cn(
            "z-40 flex min-h-0 shrink-0 flex-col bg-background text-foreground outline-none",
            layout === "sidebar"
              ? "fixed inset-y-0 right-0 w-full max-w-[420px] border-l shadow-xl lg:relative lg:inset-auto lg:h-full lg:w-(--chat-sidebar-width) lg:max-w-none lg:shadow-none"
              : "fixed bottom-[max(.75rem,env(safe-area-inset-bottom))] right-3 h-[min(680px,calc(100dvh-2rem))] w-[calc(100vw-1.5rem)] max-w-[440px] rounded-3xl border bg-card shadow-[0_8px_24px_#00000012] sm:bottom-6 sm:right-6",
          )}
        >
          <Dialog.Title className="sr-only">{CHAT_AGENT_NAME}</Dialog.Title>
          {layout === "sidebar" ? (
            // biome-ignore lint/a11y/useSemanticElements: This focusable window splitter is interactive, not a thematic hr.
            <div
              role="separator"
              aria-label="Ubah lebar sidebar chat"
              aria-orientation="vertical"
              aria-controls="learning-chat-panel"
              aria-valuemin={320}
              aria-valuemax={maxWidth}
              aria-valuenow={visibleWidth}
              aria-valuetext={`${Math.round(visibleWidth)} piksel`}
              tabIndex={0}
              title="Geser untuk mengubah lebar · klik dua kali untuk reset"
              data-resizing={resizing}
              className="group absolute inset-y-0 -left-1 z-10 hidden w-2 touch-none cursor-col-resize select-none items-center justify-center outline-none lg:flex"
              onPointerDown={(event) => {
                if (event.button !== 0 || !event.isPrimary) return;
                event.preventDefault();
                event.currentTarget.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { x: event.clientX, width: visibleWidth };
                setResizing(true);
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                setWidth(clampWidth(drag.current.width + drag.current.x - event.clientX));
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                drag.current = null;
                setResizing(false);
              }}
              onLostPointerCapture={() => {
                drag.current = null;
                setResizing(false);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setResizing(false);
              }}
              onDoubleClick={() => setWidth(420)}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 48 : 16;
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                switch (event.key) {
                  case "Home":
                    setWidth(320);
                    break;
                  case "End":
                    setWidth(maxWidth);
                    break;
                  default:
                    setWidth(clampWidth(visibleWidth + (event.key === "ArrowLeft" ? step : -step)));
                }
              }}
            >
              <span className="h-10 w-0.5 rounded-full bg-border group-hover:bg-primary/60 group-focus-visible:bg-primary group-data-[resizing=true]:bg-primary" />
            </div>
          ) : null}
          {children}
        </Dialog.Content>
      </Activity>
    </Dialog.Root>
  );
}
