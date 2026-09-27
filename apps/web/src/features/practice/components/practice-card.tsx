import {
  ArrowUpRight01Icon,
  BookOpen01Icon,
  Layers01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PracticeSummary } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/card";
import { cn } from "../../../lib/utils";
import { PracticeCardPreview } from "./practice-card-preview";

const kinds = {
  quiz: { label: "Kuis", icon: Task01Icon, accent: "text-primary", ink: "text-link" },
  flashcard: {
    label: "Flashcard",
    icon: Layers01Icon,
    accent: "text-[var(--flashcard-lavender-ink)]",
    ink: "text-[var(--flashcard-lavender-ink)]",
  },
  exam: {
    label: "Exam",
    icon: BookOpen01Icon,
    accent: "text-adaptive-edge",
    ink: "text-adaptive-foreground",
  },
};
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

export function PracticeCard({
  practice,
  linked = true,
}: {
  practice: PracticeSummary;
  linked?: boolean;
}) {
  const kind = kinds[practice.kind];
  const KindIcon = kind.icon;
  const href = `/modules/${practice.moduleId}/practice/${practice.id}`;
  return (
    <Card
      className={cn(
        "group relative min-w-0 gap-0 rounded-[18px] border p-2.5",
        linked &&
          "motion-safe:transition-[border-color,transform] hover:border-input/50 motion-safe:hover:-translate-y-0.5",
      )}
    >
      <div aria-hidden="true">
        <PracticeCardPreview practice={practice} />
      </div>
      <div className="flex min-w-0 items-center gap-3 px-1.5 pt-4 pb-3">
        <HugeiconsIcon
          icon={KindIcon}
          strokeWidth={1.5}
          className={cn("size-5 shrink-0", kind.accent)}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold tracking-tight" title={practice.title}>
            {linked ? (
              <Link
                to={href}
                className="rounded-sm after:absolute after:inset-0 after:rounded-[18px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
              >
                {practice.title}
              </Link>
            ) : (
              practice.title
            )}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {kind.label} · {practice.itemCount} {practice.kind === "flashcard" ? "kartu" : "soal"}
            {practice.kind === "exam" && practice.durationMinutes
              ? ` · ${practice.durationMinutes} menit`
              : ""}
          </p>
        </div>
        {linked ? (
          <HugeiconsIcon
            icon={ArrowUpRight01Icon}
            strokeWidth={1.5}
            className={cn("size-5 shrink-0", kind.ink)}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <time className="sr-only" dateTime={practice.createdAt}>
        Dibuat {dateFormat.format(new Date(practice.createdAt))}
      </time>
    </Card>
  );
}

export function PracticeCardSkeleton() {
  return (
    <Card className="min-w-0 gap-0 rounded-[18px] border p-2.5 motion-safe:animate-pulse">
      <div className="h-56 rounded-xl bg-muted" />
      <div className="space-y-2 px-2 py-5">
        <div className="h-4 w-4/5 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </Card>
  );
}
