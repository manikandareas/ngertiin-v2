import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import type { ModuleBuilderState } from "./use-module-builder";

export function BuilderFocus({
  state,
}: {
  state: Pick<ModuleBuilderState, "instruction" | "setInstruction">;
}) {
  return (
    <>
      <label htmlFor="builder-focus" className="block space-y-3 text-sm font-semibold">
        Fokus belajar <span className="font-normal text-muted-foreground">(opsional)</span>
        <Textarea
          id="builder-focus"
          rows={6}
          value={state.instruction}
          aria-describedby="focus-help"
          onChange={(e) => state.setInstruction(e.target.value)}
          placeholder="Contoh: Aku masih pemula. Bantu aku memahami fotosintesis dengan contoh sehari-hari."
        />
      </label>
      <p id="focus-help" className="text-xs text-muted-foreground">
        {Array.from(state.instruction).length.toLocaleString("id-ID")} / 4.000 karakter
      </p>
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
    </>
  );
}
