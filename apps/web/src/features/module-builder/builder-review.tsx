import { File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "../../components/ui/button";
import { statusLabels } from "./source-presentation";
import type { ModuleBuilderState } from "./use-module-builder";

type ReviewState = Pick<ModuleBuilderState, "selected" | "instruction" | "blocked">;
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
            Ubah fokus
          </Button>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {state.instruction.trim() || "Disesuaikan dengan materi."}
        </p>
      </div>
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
