import {
  BookOpen01Icon,
  Flag01Icon,
  Layers01Icon,
  PlayIcon,
  SparklesIcon,
  SquareLock01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { JourneyNode } from "@ngertiin/contracts/api";
import type { Ref } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../../lib/utils";
import { AdaptiveInfoTooltip } from "./adaptive-info-tooltip";

const statusLabel = {
  locked: "Terkunci",
  available: "Siap dimulai",
  in_progress: "Sedang dipelajari",
  completed: "Selesai",
} as const;

const nodeTypes = {
  lesson: { label: "Materi", icon: BookOpen01Icon },
  flashcard: { label: "Kartu belajar", icon: Layers01Icon },
  quiz: { label: "Kuis", icon: Flag01Icon },
  checkpoint: { label: "Evaluasi", icon: Flag01Icon },
  review: { label: "Ulasan", icon: BookOpen01Icon },
  practice: { label: "Latihan", icon: BookOpen01Icon },
  remedial_quiz: { label: "Kuis remedial", icon: Flag01Icon },
} satisfies Record<JourneyNode["type"], { label: string; icon: typeof BookOpen01Icon }>;

const nodeOffsets = ["ml-[15%]", "mr-[15%]", "ml-[15%]", "ml-[20%] md:ml-[27%]"];

export function JourneyNodeItem({
  node,
  index,
  moduleId,
  current,
  ref,
}: {
  node: JourneyNode;
  index: number;
  moduleId: string;
  current: boolean;
  ref?: Ref<HTMLLIElement>;
}) {
  const locked = node.progress.status === "locked";
  const completed = node.progress.status === "completed";
  const adaptive = node.origin === "adaptive";
  const evaluation = ["quiz", "checkpoint", "remedial_quiz"].includes(node.type);
  let Icon = adaptive && !evaluation ? SparklesIcon : nodeTypes[node.type].icon;
  if (current) Icon = PlayIcon;
  if (completed) Icon = Tick02Icon;
  if (locked) Icon = SquareLock01Icon;

  return (
    <li
      ref={ref}
      className={cn(
        "relative mb-25 scroll-my-25 last:mb-0",
        nodeOffsets[index % nodeOffsets.length],
      )}
    >
      <div
        className={cn(
          "group flex min-h-[110px] items-center gap-5 rounded-[20px] px-2 py-3 [overflow-wrap:anywhere] md:gap-6",
          locked && "text-muted-foreground",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative grid h-[58px] w-20 shrink-0 place-items-center md:h-[66px] md:w-24",
            evaluation ? "rounded-[24%]" : "rounded-[50%]",
            !locked &&
              "motion-safe:transition-transform motion-safe:duration-160 motion-safe:group-hover:-translate-y-1",
            adaptive
              ? cn(
                  "bg-adaptive-subtle text-adaptive-foreground shadow-[0_10px_0_var(--adaptive-edge)]",
                  current &&
                    "bg-adaptive text-adaptive-ink shadow-[0_10px_0_var(--adaptive-edge),0_0_0_7px_var(--background),0_0_0_11px_var(--adaptive)]",
                )
              : current
                ? "bg-primary text-primary-foreground shadow-[0_10px_0_var(--primary-edge),0_0_0_7px_var(--background),0_0_0_11px_var(--primary),0_20px_35px_color-mix(in_srgb,var(--primary)_25%,transparent)]"
                : completed
                  ? "bg-success-subtle text-success-foreground shadow-[0_10px_0_var(--success)]"
                  : "bg-border text-muted-foreground shadow-[0_10px_0_var(--input)]",
          )}
        >
          {current ? (
            <span
              className={cn(
                "absolute -top-[45px] z-1 grid h-[54px] w-12 -rotate-45 place-items-center rounded-[20px_20px_20px_4px]",
                adaptive
                  ? "bg-adaptive text-adaptive-ink"
                  : "bg-success text-[#234700] shadow-[-8px_8px_22px_color-mix(in_srgb,var(--success)_20%,transparent)]",
              )}
            >
              <HugeiconsIcon
                icon={PlayIcon}
                strokeWidth={1.5}
                aria-hidden="true"
                className="size-5 rotate-45 fill-current"
              />
            </span>
          ) : null}
          <span
            className={cn(
              "grid h-11 w-16 place-items-center rounded-[inherit] border-5 border-background md:h-[50px] md:w-[76px]",
              adaptive && "border-dashed",
            )}
          >
            <HugeiconsIcon icon={Icon} strokeWidth={1.5} aria-hidden="true" className="size-6" />
          </span>
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              "mb-1 flex items-center gap-1 text-xs font-bold",
              adaptive ? "text-adaptive-foreground" : "text-muted-foreground",
            )}
          >
            <span>
              {adaptive ? "Penguatan · " : ""}
              {nodeTypes[node.type].label}
            </span>
            {adaptive ? <AdaptiveInfoTooltip /> : null}
          </span>
          <span className="block text-lg font-bold leading-snug">
            {locked ? (
              node.title
            ) : (
              <Link
                aria-current={current ? "step" : undefined}
                className="after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-6 focus-visible:after:outline-ring"
                to={`/modules/${moduleId}/nodes/${node.id}`}
              >
                {node.title}
              </Link>
            )}
          </span>
          <span className="mt-2 block text-sm text-muted-foreground">
            {statusLabel[node.progress.status]}
          </span>
        </span>
      </div>
    </li>
  );
}
