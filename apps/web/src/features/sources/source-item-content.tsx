import type { Source } from "@ngertiin/contracts/api";
import type { ReactNode } from "react";
import { SourcePaper } from "./source-paper";
import { statusLabels } from "./source-presentation";
import { SourceRetry } from "./source-retry";

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });
const statusDotClass = {
  ready: "bg-success",
  pending: "bg-adaptive-edge",
  processing: "bg-adaptive-edge",
  failed: "bg-destructive",
};

/** Shared source presentation; each collection supplies its own actions. */
export function SourceItemContent({
  source,
  onPreview,
  actions,
  disabled = false,
  compact = false,
}: {
  source: Source;
  onPreview: (source: Source, trigger: HTMLElement) => void;
  actions: ReactNode;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <>
      <SourcePaper source={source} onPreview={onPreview} disabled={disabled} compact={compact} />
      <div
        className={`mt-4 flex min-w-0 items-center gap-2 text-xs text-muted-foreground ${compact ? "flex-wrap" : ""}`}
      >
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] ${source.status === "failed" ? "text-destructive" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${statusDotClass[source.status]}`}
          />
          {statusLabels[source.status]}
        </span>
        <time
          className={`shrink-0 text-[10px] ${compact ? "order-last w-full" : "ml-auto"}`}
          dateTime={source.createdAt}
        >
          {dateFormat.format(new Date(source.createdAt))}
        </time>
        {compact ? <span className="ml-auto">{actions}</span> : actions}
      </div>
      {source.status === "failed" && !source.archivedAt && !disabled ? (
        <div className="mt-3">
          <SourceRetry source={source} />
        </div>
      ) : null}
    </>
  );
}
