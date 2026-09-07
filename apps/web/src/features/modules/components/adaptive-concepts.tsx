import type { AdaptiveIntervention } from "@ngertiin/contracts/api";
import type { JSX } from "react";

interface AdaptiveConceptsProps {
  concepts: AdaptiveIntervention["targetConcepts"];
}

export function AdaptiveConcepts({ concepts }: AdaptiveConceptsProps): JSX.Element | null {
  if (!concepts.length) return null;
  return (
    <section aria-labelledby="concepts-heading" className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="concepts-heading" className="font-display text-lg font-bold">
          Konsep yang diperkuat
        </h2>
        <span className="text-xs text-muted-foreground">Pemahaman saat penguatan ditentukan</span>
      </div>
      <ul className="mt-2 divide-y divide-muted">
        {concepts.map((concept) => (
          <li key={concept.key} className="flex items-center gap-3 py-4 sm:gap-4">
            <span className="min-w-0 flex-1 break-words text-sm font-semibold">{concept.name}</span>
            <span
              aria-hidden="true"
              className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:w-22"
            >
              <span
                className="block h-full rounded-full bg-adaptive"
                style={{ width: `${Math.round(concept.masteryScore * 100)}%` }}
              />
            </span>
            <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {Math.round(concept.masteryScore * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
