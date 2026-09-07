import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dashboard } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { moduleDifficulties } from "../../modules/module-presentation";
import { moduleOverviewRoute, nextLearningRoute } from "../../modules/next-learning-route";

export function DashboardStudySheet({
  continueLearning,
  hasModules,
}: {
  continueLearning: Dashboard["continueLearning"];
  hasModules: boolean;
}) {
  const resume = continueLearning?.module;
  const progress = resume?.status === "ready" ? resume.progress : null;
  let title = "Pemahaman baru dimulai dari satu materi.";
  let destination = "/modules/new";
  let actionLabel = "Buat modul pertama";

  if (resume) {
    title = resume.title ?? "Modul baru";
    destination = nextLearningRoute(resume.nextAction) ?? moduleOverviewRoute(resume);
    actionLabel = resume.status === "ready" ? "Lanjut belajar" : "Lihat progres";
  } else if (hasModules) {
    title = "Mau membuka materi yang mana?";
    destination = "/modules";
    actionLabel = "Pilih modul";
  }

  return (
    <Card className="sm:-rotate-1 shadow-[6px_7px_0_-2px_var(--muted),6px_7px_0_var(--border)] relative isolate min-w-0 gap-0 px-6 py-7 sm:px-8 sm:py-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 left-2/5 h-6 w-24 rotate-3 border border-primary/10 bg-secondary/90"
      />
      <h2 className="text-caption font-bold tracking-wide text-muted-foreground">
        {resume ? "Masih terbuka di mejamu" : "Lembar baru untukmu"}
      </h2>
      <h3 className="mt-6 max-w-lg break-words font-display text-heading-sm font-extrabold leading-snug tracking-tight">
        {title}
      </h3>
      <p className="mt-3 text-caption leading-relaxed text-muted-foreground">
        {resume
          ? [
              resume.difficulty ? moduleDifficulties[resume.difficulty].label : null,
              resume.estimatedMinutes ? `Estimasi modul ${resume.estimatedMinutes} menit` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "Pilih materi yang ingin kamu pahami, lalu belajar selangkah demi selangkah."}
      </p>
      <div className="mt-7 flex flex-wrap items-end gap-x-6 gap-y-5">
        {progress ? (
          <div className="min-w-36 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3 text-caption text-muted-foreground">
              <span>Perjalanan belajarmu</span>
              <span className="font-bold text-link tabular-nums">
                {Math.round(progress.percentage)}%
              </span>
            </div>
            <progress
              className="learning-progress"
              aria-label="Kemajuan modul terakhir"
              value={progress.percentage}
              max={100}
            />
          </div>
        ) : null}
        <Button asChild size="sm" className="max-w-full">
          <Link to={destination}>
            {actionLabel}
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
