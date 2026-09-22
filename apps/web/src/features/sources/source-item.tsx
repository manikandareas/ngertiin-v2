import type { Source } from "@ngertiin/contracts/api";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { useRef } from "react";
import { Button } from "../../components/ui/button";
import { menuContentClassName } from "../../components/ui/menu-styles";
import { type SourceAction, SourceActionItems } from "./source-actions";
import { SourceItemContent } from "./source-item-content";
import { sourceTitle } from "./source-presentation";

type SourceItemProps = {
  source: Source;
  onPreview: (source: Source, trigger: HTMLElement) => void;
  onAction: (action: SourceAction, trigger: HTMLElement | null) => void;
};

export function SourceItem({ source, onPreview, onAction }: SourceItemProps) {
  const title = sourceTitle(source);
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
          className="min-w-0 px-3 pt-4 pb-2"
          onContextMenu={(event) => {
            trigger.current = event.currentTarget.querySelector("button");
          }}
        >
          <SourceItemContent
            source={source}
            onPreview={onPreview}
            actions={
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg text-muted-foreground"
                    aria-label={`Tindakan untuk ${title}`}
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
                    collisionPadding={12}
                    className={menuContentClassName}
                    align="end"
                    onCloseAutoFocus={closeMenu}
                  >
                    <SourceActionItems menu="dropdown" source={source} onAction={openAction} />
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            }
          />
        </article>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={menuContentClassName}
          collisionPadding={12}
          onCloseAutoFocus={closeMenu}
        >
          <SourceActionItems menu="context" source={source} onAction={openAction} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
