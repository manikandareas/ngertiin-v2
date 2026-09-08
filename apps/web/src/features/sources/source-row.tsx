import type { Source } from "@ngertiin/contracts/api";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { useRef } from "react";
import { Button } from "../../components/ui/button";
import { menuContentClassName } from "../../components/ui/menu-styles";
import { type SourceAction, SourceActionItems } from "./source-actions";
import { sourceMetadata, sourceTitle } from "./source-presentation";
import { SourceRetry } from "./source-retry";

type SourceRowProps = {
  source: Source;
  onPreview: (source: Source, trigger: HTMLElement) => void;
  onAction: (action: SourceAction, trigger: HTMLElement | null) => void;
};

export function SourceRow({ source, onPreview, onAction }: SourceRowProps) {
  const trigger = useRef<HTMLElement | null>(null);
  const openingDialog = useRef(false);
  function openAction(action: SourceAction) {
    openingDialog.current = true;
    onAction(action, trigger.current);
  }
  function closeMenu(event: Event) {
    if (openingDialog.current) event.preventDefault();
    openingDialog.current = false;
  }
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <article
          className="border-b p-4 last:border-0 sm:p-5"
          onContextMenu={(event) => {
            trigger.current = event.currentTarget.querySelector("button");
          }}
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring"
              onClick={(event) => onPreview(source, event.currentTarget)}
            >
              <span className="block truncate font-semibold">{sourceTitle(source)}</span>
              <span className="mt-2 block text-xs leading-6 text-muted-foreground">
                {sourceMetadata(source)}
              </span>
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Tindakan untuk ${sourceTitle(source)}`}
                  onPointerDown={(event) => {
                    trigger.current = event.currentTarget;
                  }}
                  onKeyDown={(event) => {
                    trigger.current = event.currentTarget;
                  }}
                >
                  •••
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={menuContentClassName}
                  align="end"
                  onCloseAutoFocus={closeMenu}
                >
                  <SourceActionItems menu="dropdown" source={source} onAction={openAction} />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          {source.status === "failed" && !source.archivedAt ? (
            <div className="mt-3">
              <SourceRetry source={source} />
            </div>
          ) : null}
        </article>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={menuContentClassName} onCloseAutoFocus={closeMenu}>
          <SourceActionItems menu="context" source={source} onAction={openAction} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
