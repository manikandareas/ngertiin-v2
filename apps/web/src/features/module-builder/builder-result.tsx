import type { ModuleSummary } from "@ngertiin/contracts/api";
import { Clock3, Layers } from "lucide-react";
import type { JSX } from "react";
import { BuilderJourneyPreview } from "./builder-journey-preview";

type BuilderResultProps = {
  module: ModuleSummary;
};

export function BuilderResult({ module }: BuilderResultProps): JSX.Element {
  return (
    <div>
      <section className="min-w-0 pb-8" aria-label="Ringkasan modul">
        <h2 className="break-words text-balance font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          {module.title ?? "Modul belajarmu"}
        </h2>
        {module.description ? (
          <p className="mt-3 max-w-prose break-words text-pretty text-sm leading-6 text-muted-foreground">
            {module.description}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {module.difficulty ? (
            <span className="font-bold text-foreground">
              {
                { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjutan" }[
                  module.difficulty
                ]
              }
            </span>
          ) : null}
          {module.progress ? (
            <span className="flex items-center gap-2">
              <Layers aria-hidden="true" className="size-4" />
              {module.progress.totalCoreNodes} node utama
            </span>
          ) : null}
          {module.estimatedMinutes ? (
            <span className="flex items-center gap-2">
              <Clock3 aria-hidden="true" className="size-4" />
              {module.estimatedMinutes} menit
            </span>
          ) : null}
        </div>
      </section>
      <BuilderJourneyPreview moduleId={module.id} archived={module.status === "archived"} />
    </div>
  );
}
