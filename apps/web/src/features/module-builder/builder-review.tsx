import { File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GENERATION_LANGUAGES } from "@ngertiin/contracts/api";
import { Button } from "../../components/ui/button";
import { statusLabels } from "../sources/source-presentation";
import { activityLabels, generationLengthLabel } from "./generation-settings-presentation";
import type { ModuleBuilderState } from "./use-module-builder";

type ReviewState = Pick<
  ModuleBuilderState,
  "selected" | "instruction" | "blocked" | "generationSettings"
>;
export function BuilderReview({
  state,
  onEdit,
}: {
  state: ReviewState;
  onEdit: (step: number) => void;
}) {
  return (
    <>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Materi belajar</h2>
          <Button variant="link" size="sm" onClick={() => onEdit(0)}>
            Ubah materi
          </Button>
        </div>
        <MaterialList state={state} />
      </div>
      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Fokus belajar</h2>
          <Button variant="link" size="sm" onClick={() => onEdit(1)}>
            Ubah fokus & pengaturan
          </Button>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {state.instruction.trim() || "Disesuaikan dengan materi."}
        </p>
      </div>
      <dl className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Bahasa modul</dt>
          <dd className="mt-1 font-medium">
            {GENERATION_LANGUAGES[state.generationSettings.language].label}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Jumlah langkah</dt>
          <dd className="mt-1 font-medium">
            {generationLengthLabel(state.generationSettings.length)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Jenis aktivitas</dt>
          <dd className="mt-1 font-medium">
            {state.generationSettings.activityTypes
              .map((type) => activityLabels[type])
              .join(", ") || "Belum dipilih"}
          </dd>
        </div>
      </dl>
      <p className="rounded-xl bg-secondary p-4 text-sm leading-relaxed text-secondary-foreground">
        Materimu akan dirangkai menjadi alur belajar, penjelasan, dan aktivitas untuk membantu kamu
        memahami setiap konsep.
      </p>
      {state.blocked ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.blocked}
        </p>
      ) : null}
    </>
  );
}

function MaterialList({ state }: { state: Pick<ModuleBuilderState, "selected"> }) {
  return (
    <ul className="divide-y">
      {state.selected.map((item) => (
        <li key={item.source.id} className="flex items-center gap-3 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
            <HugeiconsIcon
              icon={File01Icon}
              size={20}
              strokeWidth={1.5}
              className="size-5"
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold">
              {item.source.title ?? "Materi tanpa judul"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.source.type.toUpperCase()} ·{" "}
              {item.role === "primary"
                ? "Utama"
                : item.role === "reference"
                  ? "Referensi"
                  : "Pelengkap"}
              {item.selector ? ` · Hal. ${item.selector.pages.from}–${item.selector.pages.to}` : ""}{" "}
              · {statusLabels[item.source.status]}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
