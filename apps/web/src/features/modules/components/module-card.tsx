import type { ModuleSummary } from "@ngertiin/contracts/api";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../../components/ui/card";
import { nextLearningRoute } from "../next-learning-route";

const statusLabels: Record<ModuleSummary["status"], string> = {
  generating: "Sedang dibuat",
  ready: "Siap dipelajari",
  failed: "Perlu dicoba lagi",
  archived: "Diarsipkan",
};

export function ModuleCard({ module }: { module: ModuleSummary }) {
  const destination = nextLearningRoute(module.nextAction) ?? `/modules/${module.id}`;
  const percentage = module.progress?.percentage ?? 0;
  const action =
    module.status !== "ready"
      ? "Lihat status"
      : percentage >= 100
        ? "Lihat modul"
        : percentage > 0
          ? "Lanjutkan"
          : "Mulai belajar";
  return (
    <Card className="min-w-0 gap-4">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="grid size-12 place-items-center rounded-button bg-accent text-primary">
            <BookOpen aria-hidden="true" className="size-6" />
          </span>
          <span className="text-caption font-bold text-muted-foreground">
            {statusLabels[module.status]}
          </span>
        </div>
        <CardTitle className="break-words">{module.title ?? "Modul baru"}</CardTitle>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {module.description ?? "Materi belajarmu sedang dipersiapkan."}
        </p>
      </CardHeader>
      {module.progress ? (
        <CardContent>
          <div className="mb-2 flex justify-between text-caption font-bold text-muted-foreground">
            <span>{percentage >= 100 ? "Selesai" : "Progress belajar"}</span>
            <span>{percentage}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progress ${module.title ?? "modul"}`}
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
          </div>
        </CardContent>
      ) : null}
      <CardFooter className="mt-auto">
        <Button asChild variant="outline" className="w-full">
          <Link to={destination}>
            {action}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
