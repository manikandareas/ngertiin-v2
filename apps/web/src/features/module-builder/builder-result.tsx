import {
  ArrowRight01Icon,
  BookOpen01Icon,
  Clock01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ModuleSummary } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { nextLearningRoute } from "../modules/next-learning-route";

export function BuilderResult({ module }: { module: ModuleSummary }) {
  return (
    <div className="py-6 text-center">
      <div className="generation-finish relative mx-auto mb-8 grid size-28 place-items-center rounded-full border-2 border-primary bg-secondary text-link">
        <HugeiconsIcon
          icon={BookOpen01Icon}
          size={48}
          strokeWidth={1.5}
          className="size-12"
          aria-hidden="true"
        />
        <span className="absolute -right-1 top-0 rounded-full bg-background p-2">
          <HugeiconsIcon
            icon={SparklesIcon}
            size={24}
            strokeWidth={1.5}
            className="size-6 text-link"
            aria-hidden="true"
          />
        </span>
      </div>
      <h2 className="break-words font-display text-2xl font-extrabold">
        {module.title ?? "Modul belajarmu"}
      </h2>
      {module.description ? (
        <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          {module.description}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
        {module.difficulty ? (
          <span>
            {
              { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjutan" }[
                module.difficulty
              ]
            }
          </span>
        ) : null}
        {module.estimatedMinutes ? (
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={Clock01Icon}
              size={16}
              strokeWidth={1.5}
              className="size-4"
              aria-hidden="true"
            />
            {module.estimatedMinutes} menit
          </span>
        ) : null}
      </div>
      <Button asChild size="lg" className="mt-9">
        <Link
          to={
            module.status === "archived"
              ? `/modules/${module.id}/journey`
              : (nextLearningRoute(module.nextAction) ?? `/modules/${module.id}/journey`)
          }
        >
          {module.status === "archived" ? "Lihat modul" : "Mulai belajar"}
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </Button>
      <div className="mt-4">
        <Button asChild variant="ghost">
          <Link to="/dashboard">Kembali ke Beranda</Link>
        </Button>
      </div>
    </div>
  );
}
