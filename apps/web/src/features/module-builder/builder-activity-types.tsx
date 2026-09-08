import { GENERATION_ACTIVITY_TYPES } from "@ngertiin/contracts/api";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "../../components/ui/field";
import { activityLabels } from "./generation-settings-presentation";
import type { ModuleBuilderState } from "./use-module-builder";

type ActivityTypesProps = {
  state: Pick<ModuleBuilderState, "generationSettings" | "setGenerationSettings" | "busy">;
};

export function BuilderActivityTypes({ state }: ActivityTypesProps) {
  const settings = state.generationSettings;
  const invalid = settings.activityTypes.length === 0;
  return (
    <FieldSet aria-describedby="module-activities-help" className="gap-3">
      <FieldLegend variant="label">Jenis aktivitas</FieldLegend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {GENERATION_ACTIVITY_TYPES.map((type) => (
          <FieldLabel key={type} htmlFor={`module-activity-${type}`} className="cursor-pointer">
            <Field
              orientation="horizontal"
              data-invalid={invalid}
              data-disabled={state.busy}
              className="min-h-11 gap-3 rounded-lg hover:bg-muted/50"
            >
              <Checkbox
                id={`module-activity-${type}`}
                disabled={state.busy}
                aria-describedby={
                  invalid
                    ? "module-activities-help module-activities-error"
                    : "module-activities-help"
                }
                checked={settings.activityTypes.includes(type)}
                aria-invalid={invalid}
                onCheckedChange={(checked) => {
                  state.setGenerationSettings((current) => ({
                    ...current,
                    activityTypes: GENERATION_ACTIVITY_TYPES.filter((candidate) =>
                      candidate === type
                        ? checked === true
                        : current.activityTypes.includes(candidate),
                    ),
                  }));
                }}
              />
              <FieldTitle>{activityLabels[type]}</FieldTitle>
            </Field>
          </FieldLabel>
        ))}
      </div>
      <FieldDescription id="module-activities-help" className="text-xs">
        Pilih minimal satu. Modul hanya memakai jenis yang dipilih, dan tidak harus memakai
        semuanya.
      </FieldDescription>
      {invalid ? (
        <FieldError id="module-activities-error">Pilih minimal satu jenis aktivitas.</FieldError>
      ) : null}
    </FieldSet>
  );
}
