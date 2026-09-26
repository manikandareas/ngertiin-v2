import { ArrowLeft, Clock3, List, Square } from "lucide-react";
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../../../components/theme-toggle";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import type { PracticeExamView } from "../use-practice-exam-navigation";

type Props = {
  title: string;
  backTo: string;
  canAnswer: boolean;
  active: boolean;
  seconds: number | null;
  answered: number;
  total: number;
  view: PracticeExamView;
  onViewChange: (view: PracticeExamView) => void;
};

export function PracticeExamHeader({
  title,
  backTo,
  canAnswer,
  active,
  seconds,
  answered,
  total,
  view,
  onViewChange,
}: Props): ReactElement {
  return (
    <header className="relative shrink-0 border-b bg-background px-3 sm:px-8">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 lg:grid lg:grid-cols-[1fr_minmax(0,1fr)_1fr] lg:gap-4">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-9 rounded-full lg:justify-self-start"
        >
          <Link to={backTo} aria-label="Kembali ke detail exam">
            <ArrowLeft />
          </Link>
        </Button>
        <h1
          className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base lg:text-center"
          title={title}
        >
          {title}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 lg:justify-self-end">
          {canAnswer ? (
            <fieldset
              aria-label="Tampilan soal"
              className="flex shrink-0 gap-0.5 rounded-xl border bg-card p-1"
            >
              <Button
                size="sm"
                variant="ghost"
                aria-label="Fokus"
                title="Fokus"
                className={cn(
                  "h-8 px-2 text-muted-foreground normal-case tracking-normal",
                  view === "focus" && "bg-secondary text-secondary-foreground hover:bg-secondary",
                )}
                aria-pressed={view === "focus"}
                onClick={() => onViewChange("focus")}
              >
                <Square />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Semua soal"
                title="Semua soal"
                className={cn(
                  "h-8 px-2 text-muted-foreground normal-case tracking-normal",
                  view === "list" && "bg-secondary text-secondary-foreground hover:bg-secondary",
                )}
                aria-pressed={view === "list"}
                onClick={() => onViewChange("list")}
              >
                <List />
              </Button>
            </fieldset>
          ) : null}
          {active && seconds !== null ? (
            <span
              role="timer"
              aria-label="Sisa waktu"
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold tabular-nums",
                seconds <= 300
                  ? "border-adaptive bg-adaptive-subtle text-adaptive-foreground"
                  : "bg-card",
              )}
            >
              <Clock3 className="size-4" />
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </span>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
      {active ? (
        <progress
          aria-label={`${answered} dari ${total} soal terjawab`}
          className="learning-progress absolute inset-x-0 bottom-0 h-[3px]! rounded-none!"
          value={answered}
          max={Math.max(1, total)}
        />
      ) : null}
    </header>
  );
}
