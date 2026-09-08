import { Button } from "../../components/ui/button";
import { Field, FieldDescription, FieldLabel } from "../../components/ui/field";
import { Textarea } from "../../components/ui/textarea";
import { BuilderGenerationSettings } from "./builder-generation-settings";
import { BuilderLanguage } from "./builder-language";
import type { ModuleBuilderState } from "./use-module-builder";

export function BuilderFocus({
  state,
}: {
  state: Pick<
    ModuleBuilderState,
    "instruction" | "setInstruction" | "generationSettings" | "setGenerationSettings" | "busy"
  >;
}) {
  return (
    <>
      <BuilderLanguage state={state} />
      <Field>
        <FieldLabel htmlFor="builder-focus">
          Fokus belajar <span className="font-normal text-muted-foreground">(opsional)</span>
        </FieldLabel>
        <Textarea
          id="builder-focus"
          rows={6}
          value={state.instruction}
          aria-describedby="focus-help"
          onChange={(e) => state.setInstruction(e.target.value)}
          placeholder="Contoh: Aku masih pemula. Bantu aku memahami fotosintesis dengan contoh sehari-hari."
        />
        <FieldDescription id="focus-help" className="text-xs">
          {Array.from(state.instruction).length.toLocaleString("id-ID")} / 4.000 karakter
        </FieldDescription>
      </Field>
      <div>
        <p className="mb-3 text-sm text-muted-foreground">Tambahkan arahan singkat:</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["Pahami dari dasar", "Jelaskan dari dasar untuk pemula."],
            ["Persiapan ujian", "Fokus pada konsep penting untuk persiapan ujian."],
            ["Penerapan sehari-hari", "Hubungkan materi dengan contoh sehari-hari."],
          ].map(([label, value]) => (
            <Button
              key={label}
              size="sm"
              variant="secondary"
              className="normal-case tracking-normal"
              onClick={() =>
                state.setInstruction(
                  state.instruction.trim() ? `${state.instruction.trim()}\n${value}` : value,
                )
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <p className="rounded-xl bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
        Tanpa arahan tambahan, modul akan disusun berdasarkan materi yang kamu pilih.
      </p>
      <BuilderGenerationSettings state={state} />
    </>
  );
}
