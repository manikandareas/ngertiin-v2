import { File01Icon, GlobalIcon, NoteEditIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Source } from "@ngertiin/contracts/api";
import type { ReactNode } from "react";
import { Card } from "../../components/ui/card";
import { SourcePaper } from "./source-paper";
import { sourceTitle, statusLabels } from "./source-presentation";
import { SourceRetry } from "./source-retry";

const sourceStyles = {
  pdf: {
    icon: File01Icon,
    label: "PDF",
    backdrop: "bg-[light-dark(#ddf3fe,#51baf0)]",
    paper:
      "rotate-[-5deg] bg-[light-dark(#f2fbff,#e6f3fb)] text-[#09364e] border-[#3296c4] border-l-[#1686b8]",
    ink: "text-link",
  },
  url: {
    icon: GlobalIcon,
    label: "Tautan",
    backdrop: "bg-[light-dark(#eae2ff,#bcacf0)]",
    paper: "rotate-[5deg] bg-[#faf7ff] text-[#423567] outline-[#9b85ca]",
    ink: "text-[var(--flashcard-lavender-ink)]",
  },
  text: {
    icon: NoteEditIcon,
    label: "Teks",
    backdrop: "bg-[light-dark(#fff4ce,#d9af58)]",
    paper: "rotate-[-3deg] bg-[#fff9e6] text-[#705000]",
    ink: "text-adaptive-foreground",
  },
};
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

/** Shared source card; collections supply their own actions. */
export function SourceCard({
  source,
  onPreview,
  actions,
  disabled = false,
}: {
  source: Source;
  onPreview: (source: Source, trigger: HTMLElement) => void;
  actions?: ReactNode;
  disabled?: boolean;
}) {
  const title = sourceTitle(source);
  const style = sourceStyles[source.type];
  return (
    <Card className="group min-w-0 gap-0 rounded-[18px] border p-2.5 motion-safe:transition-[border-color,transform] hover:border-input/50 motion-safe:hover:-translate-y-0.5">
      <div className={`relative h-56 overflow-hidden rounded-xl ${style.backdrop}`}>
        <div className="absolute top-6 left-[10%] w-4/5 motion-safe:transition-transform motion-safe:group-hover:-translate-y-1">
          <SourcePaper
            source={source}
            onPreview={onPreview}
            compact
            disabled={disabled}
            className={style.paper}
          />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3 px-1.5 pt-4 pb-3">
        <HugeiconsIcon
          icon={style.icon}
          strokeWidth={1.5}
          className={`size-5 shrink-0 ${style.ink}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold tracking-tight" title={title}>
            <button
              type="button"
              disabled={disabled}
              className="max-w-full cursor-pointer truncate rounded-sm text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={(event) => onPreview(source, event.currentTarget)}
            >
              {title}
            </button>
          </h2>
          <p
            className={`mt-1 text-xs ${source.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {style.label} · {statusLabels[source.status]}
          </p>
        </div>
        {actions}
      </div>
      <time className="sr-only" dateTime={source.createdAt}>
        {dateFormat.format(new Date(source.createdAt))}
      </time>
      {source.status === "failed" && !source.archivedAt && !disabled ? (
        <div className="px-1.5 pb-2">
          <SourceRetry source={source} />
        </div>
      ) : null}
    </Card>
  );
}
