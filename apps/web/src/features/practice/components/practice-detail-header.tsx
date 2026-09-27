import {
  Archive02Icon,
  BookOpen01Icon,
  ChartColumnIcon,
  Clock01Icon,
  Layers01Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PracticeDetail } from "@ngertiin/contracts/api";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

const difficulty = { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjutan" };
const kinds = {
  flashcard: {
    label: "Flashcard",
    icon: Layers01Icon,
    badge: "bg-[var(--flashcard-lavender-surface)] text-[var(--flashcard-lavender-ink)]",
  },
  quiz: { label: "Kuis", icon: Task01Icon, badge: "bg-secondary text-secondary-foreground" },
  exam: {
    label: "Exam",
    icon: BookOpen01Icon,
    badge: "bg-adaptive-subtle text-adaptive-foreground",
  },
};

type Props = {
  practice: PracticeDetail;
  busy: boolean;
  onRename: () => void;
  onToggleArchive: () => void;
};
export function PracticeDetailHeader({ practice: data, busy, onRename, onToggleArchive }: Props) {
  const kind = data.kind;
  const { label, icon: KindIcon, badge } = kinds[kind];
  return (
    <header>
      <span
        className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-semibold ${badge}`}
      >
        <HugeiconsIcon icon={KindIcon} strokeWidth={1.5} aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="min-w-0 font-display text-2xl font-bold tracking-tight wrap-anywhere sm:text-3xl">
          {data.title}
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={busy}
              aria-label="Kelola latihan"
            >
              <HugeiconsIcon
                icon={MoreHorizontalIcon}
                strokeWidth={1.5}
                aria-hidden="true"
                className="size-5"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>
              <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={1.5} aria-hidden="true" />
              Ganti judul
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleArchive}>
              <HugeiconsIcon icon={Archive02Icon} strokeWidth={1.5} aria-hidden="true" />
              {data.archivedAt ? "Pulihkan latihan" : "Arsipkan latihan"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed wrap-anywhere text-muted-foreground">
        {data.configuration.focus}
      </p>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <HugeiconsIcon icon={KindIcon} strokeWidth={1.5} aria-hidden="true" className="size-4" />
          {data.itemCount} {kind === "flashcard" ? "kartu" : "soal"}
        </span>
        <span className="inline-flex items-center gap-2">
          <HugeiconsIcon
            icon={ChartColumnIcon}
            strokeWidth={1.5}
            aria-hidden="true"
            className="size-4"
          />
          {difficulty[data.configuration.difficulty]}
        </span>
        <span className="inline-flex items-center gap-2">
          <HugeiconsIcon
            icon={Clock01Icon}
            strokeWidth={1.5}
            aria-hidden="true"
            className="size-4"
          />
          {kind === "exam" ? `${data.configuration.durationMinutes} menit` : "Tanpa timer"}
        </span>
      </div>
    </header>
  );
}
