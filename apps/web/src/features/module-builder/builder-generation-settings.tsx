import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { generationLengthSchema } from "@ngertiin/contracts/api";
import { Button } from "../../components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../../components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Separator } from "../../components/ui/separator";
import { BuilderActivityTypes } from "./builder-activity-types";
import { generationLengthLabel } from "./generation-settings-presentation";
import type { ModuleBuilderState } from "./use-module-builder";

type SettingsState = Pick<
  ModuleBuilderState,
  "generationSettings" | "setGenerationSettings" | "busy"
>;

export function BuilderGenerationSettings({ state }: { state: SettingsState }) {
  const settings = state.generationSettings;
  return (
    <Collapsible className="rounded-xl border" disabled={state.busy}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="group min-h-14 w-full justify-between rounded-xl px-4 py-3 text-sm font-semibold normal-case tracking-normal"
        >
          Pengaturan lanjutan
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground motion-safe:transition-transform group-data-[state=open]:rotate-180"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <FieldGroup className="gap-5 border-t px-4 py-5 sm:px-5">
          <Field className="[&>[data-slot=select-trigger]]:w-fit">
            <FieldLabel htmlFor="module-length">Jumlah langkah belajar</FieldLabel>
            <Select
              value={settings.length}
              disabled={state.busy}
              onValueChange={(value) => {
                const length = generationLengthSchema.parse(value);
                state.setGenerationSettings((current) => ({ ...current, length }));
              }}
            >
              <SelectTrigger
                id="module-length"
                aria-describedby="module-length-help"
                className="min-w-44 max-w-full rounded-xl shadow-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {generationLengthSchema.options.map((length) => (
                  <SelectItem key={length} value={length}>
                    {generationLengthLabel(length)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription id="module-length-help" className="text-xs">
              Otomatis menyesuaikan materi, antara 1–20 langkah. Jumlah mencakup seluruh langkah
              utama.
            </FieldDescription>
          </Field>
          <Separator />
          <BuilderActivityTypes state={state} />
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  );
}
