import type { Dashboard } from "@ngertiin/contracts/api";
import { ArrowRight, Atom, BookOpen, Brain, Lightbulb, Plus, Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { nextLearningRoute } from "../../modules/next-learning-route";

const moduleIcons = [Atom, Brain, Rocket, Lightbulb, BookOpen];
const difficultyLabels = { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjutan" };

export function DashboardModules({
  modules,
  continueLearning,
}: Pick<Dashboard, "modules" | "continueLearning">) {
  const choices =
    continueLearning && !modules.some((module) => module.id === continueLearning.module.id)
      ? [continueLearning.module, ...modules]
      : modules;
  return (
    <section aria-labelledby="modules-heading" className="min-w-0">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 id="modules-heading" className="text-xl font-extrabold">
          Modul belajarmu
        </h1>
        <Link
          to="/modules"
          className="inline-flex min-h-10 items-center gap-1 text-caption font-bold text-link"
        >
          Semua modul
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </header>
      {choices.length ? (
        <ul className="space-y-3">
          {choices.map((module, index) => {
            const Icon = moduleIcons[index % moduleIcons.length] ?? BookOpen;
            const progress = module.progress;
            const destination = nextLearningRoute(module.nextAction) ?? `/modules/${module.id}`;
            const action =
              module.status === "generating"
                ? "Lihat proses"
                : module.status === "failed"
                  ? "Lihat kendala"
                  : module.status === "archived" || progress?.status === "completed"
                    ? "Lihat modul"
                    : progress?.status === "in_progress"
                      ? "Lanjutkan"
                      : "Mulai";
            return (
              <li key={module.id}>
                <article className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-button border-2 bg-card p-4 sm:grid-cols-[48px_minmax(0,1fr)_auto]">
                  <span
                    aria-hidden="true"
                    className="grid size-11 place-items-center rounded-lg bg-accent text-primary sm:size-12"
                  >
                    <Icon className="size-6" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-extrabold leading-snug">
                      {module.title ?? "Modul baru"}
                    </h2>
                    <p className="mt-1 text-caption text-muted-foreground">
                      {module.status === "generating"
                        ? "Sedang disiapkan…"
                        : module.status === "failed"
                          ? "Perlu dicoba lagi"
                          : module.status === "archived"
                            ? "Diarsipkan"
                            : [
                                module.difficulty ? difficultyLabels[module.difficulty] : null,
                                module.estimatedMinutes ? `${module.estimatedMinutes} menit` : null,
                                progress ? `${progress.percentage}% selesai` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                    </p>
                    {module.status === "ready" && progress ? (
                      <div
                        role="progressbar"
                        aria-label={`Progress ${module.title ?? "modul"}`}
                        aria-valuenow={progress.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-2 h-1.5 max-w-52 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant={continueLearning?.module.id === module.id ? "default" : "secondary"}
                    className="col-start-2 justify-self-start normal-case tracking-normal sm:col-start-auto sm:justify-self-end"
                  >
                    <Link
                      aria-label={`${action}: ${module.title ?? "Modul baru"}`}
                      to={destination}
                    >
                      {action}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="items-start gap-4 p-6">
          <BookOpen aria-hidden="true" className="size-8 text-primary" />
          <div>
            <h2 className="text-subheading font-bold">Mulai dari satu modul.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tambahkan materi yang ingin kamu pahami.
            </p>
          </div>
          <Button asChild className="normal-case tracking-normal">
            <Link to="/modules/new">
              Buat modul pertama
              <Plus aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      )}
    </section>
  );
}
