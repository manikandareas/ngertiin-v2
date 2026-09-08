import { GENERATION_LANGUAGES, generationLanguageSchema } from "@ngertiin/contracts/api";
import { Field, FieldLabel } from "../../components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type { ModuleBuilderState } from "./use-module-builder";

type SettingsState = Pick<
  ModuleBuilderState,
  "generationSettings" | "setGenerationSettings" | "busy"
>;

export function BuilderLanguage({ state }: { state: SettingsState }) {
  const settings = state.generationSettings;
  return (
    <Field className="[&>[data-slot=select-trigger]]:w-fit">
      <FieldLabel htmlFor="module-language">Bahasa modul</FieldLabel>
      <Select
        value={settings.language}
        disabled={state.busy}
        onValueChange={(value) => {
          const language = generationLanguageSchema.parse(value);
          state.setGenerationSettings((current) => ({ ...current, language }));
        }}
      >
        <SelectTrigger id="module-language" className="min-w-52 max-w-full rounded-xl shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {generationLanguageSchema.options.map((language) => (
            <SelectItem
              key={language}
              value={language}
              textValue={GENERATION_LANGUAGES[language].label}
            >
              <span aria-hidden="true">{GENERATION_LANGUAGES[language].flag}</span>
              {GENERATION_LANGUAGES[language].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
