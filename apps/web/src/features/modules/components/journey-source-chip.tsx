import type { JourneySummary } from "@ngertiin/contracts/api";
import { ArrowUpRight, FileText, Globe2, NotebookPen } from "lucide-react";
import { fileChipClassName } from "../../../components/ui/file-chip";
import { cn } from "../../../lib/utils";

const sourceChipStyles = {
  pdf: { icon: FileText, badge: "bg-source-book-spine" },
  url: { icon: Globe2, badge: "bg-source-postcard-art-ink" },
  text: { icon: NotebookPen, badge: "bg-source-note-ink" },
} as const;

export function JourneySourceChip({
  source,
  index,
}: {
  source: JourneySummary["sources"][number];
  index: number;
}) {
  const style = sourceChipStyles[source.type];
  const Icon = style.icon;

  return (
    <a
      href={`/sources/${source.id}`}
      target="_blank"
      rel="noopener noreferrer"
      title={source.title}
      aria-label={`Buka sumber ${index + 1}: ${source.title} di tab baru`}
      className={cn(
        fileChipClassName,
        "w-fit max-w-[min(100%,16rem)] text-left transition-colors hover:bg-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none dark:hover:bg-zinc-700",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white",
          style.badge,
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <span className="min-w-0 truncate">{source.title}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{index + 1}</span>
      <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}
