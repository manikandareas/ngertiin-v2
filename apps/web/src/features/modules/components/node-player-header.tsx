import { Sparkles, X } from "lucide-react";
import type { JSX } from "react";
import { Link } from "react-router-dom";

interface NodePlayerHeaderProps {
  moduleId: string;
  title: string;
  activityCount: number;
  slide: number;
  showResult: boolean;
}

export function NodePlayerHeader({
  moduleId,
  title,
  activityCount,
  slide,
  showResult,
}: NodePlayerHeaderProps): JSX.Element {
  const position = slide + 1;
  const currentPosition = slide < activityCount ? position : slide;
  return (
    <header className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center gap-2 pb-1 sm:gap-4 sm:pb-2">
      <Link
        aria-label="Keluar dari node dan kembali ke Journey"
        to={`/modules/${moduleId}/journey`}
        className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="size-5" />
      </Link>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
          <span className="truncate">{title}</span>
          <span className="shrink-0">
            {showResult
              ? "Hasil belajar"
              : `${Math.min(position, activityCount)} / ${activityCount}`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Posisi aktivitas"
          aria-valuemin={0}
          aria-valuemax={activityCount || 1}
          aria-valuenow={showResult ? activityCount : currentPosition}
          className="h-1.5 overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full origin-left rounded-full bg-primary motion-safe:transition-transform"
            style={{
              transform: `scaleX(${showResult ? 1 : position / Math.max(activityCount, 1)})`,
            }}
          />
        </div>
      </div>
      <span className="grid size-11 place-items-center text-primary" title="Ruang belajar">
        <Sparkles className="size-5" />
      </span>
    </header>
  );
}
