import type { Source } from "@ngertiin/contracts/api";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { useRef } from "react";
import { Button } from "../../components/ui/button";
import { menuContentClassName } from "../../components/ui/menu-styles";
import { type SourceAction, SourceActionItems } from "./source-actions";
import { SourcePaper } from "./source-paper";
import { sourceTitle, statusLabels } from "./source-presentation";
import { SourceRetry } from "./source-retry";

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });
const statusDotClass = {
  ready: "bg-success",
  pending: "bg-adaptive-edge",
  processing: "bg-adaptive-edge",
  failed: "bg-destructive",
};

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
          <SourcePaper source={source} onPreview={onPreview} />
          <div className="mt-4 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] ${source.status === "failed" ? "text-destructive" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${statusDotClass[source.status]}`}
              />
              {statusLabels[source.status]}
            </span>
            <time className="ml-auto shrink-0 text-[10px]" dateTime={source.createdAt}>
              {dateFormat.format(new Date(source.createdAt))}
            </time>
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
