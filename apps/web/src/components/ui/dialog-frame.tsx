import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

type DialogFrameProps = {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  onClose: () => void;
  returnFocus: () => void;
  busy?: boolean;
  className?: string;
};

export function DialogFrame({
  open,
  title,
  description,
  children,
  onClose,
  returnFocus,
  busy = false,
  className,
}: DialogFrameProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-61 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-background p-6 text-foreground shadow-xl motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95",
            className,
          )}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <header className="mb-6 min-w-0 pr-9">
            <Dialog.Title className="font-display text-xl font-bold wrap-anywhere">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </Dialog.Description>
          </header>
          <Dialog.Close asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              className="absolute right-4 top-4 size-8 p-0"
              aria-label="Tutup dialog"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
