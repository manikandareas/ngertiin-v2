import {
  type CurrentUser,
  type GenerationSettings,
  generationSettingsSchema,
  ianaTimezoneSchema,
} from "@ngertiin/contracts/api";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { BuilderGenerationSettings } from "../module-builder/builder-generation-settings";
import { BuilderLanguage } from "../module-builder/builder-language";
import { SettingsRow } from "./settings-row";
import { settingsError, useSettingsForm } from "./use-settings-form";

const zones = Array.from(
  new Set([
    "Asia/Jakarta",
    "Asia/Makassar",
    "Asia/Jayapura",
    "UTC",
    ...Intl.supportedValuesOf("timeZone"),
  ]),
);
const zoneNames: Record<string, string> = {
  "Asia/Jakarta": "WIB · Jakarta (UTC+7)",
  "Asia/Makassar": "WITA · Makassar (UTC+8)",
  "Asia/Jayapura": "WIT · Jayapura (UTC+9)",
};
export function LearningSettings({
  user,
  onDirty,
}: {
  user: CurrentUser;
  onDirty: (dirty: boolean) => void;
}) {
  const [timezoneDraft, setTimezone] = useState<string | null>(null);
  const [settingsDraft, setSettings] = useState<GenerationSettings | null>(null);
  const timezone = timezoneDraft ?? user.timezone;
  const generationSettings = settingsDraft ?? user.defaultGenerationSettings;
  const dirty =
    timezone !== user.timezone ||
    JSON.stringify(generationSettings) !== JSON.stringify(user.defaultGenerationSettings);
  const save = useSettingsForm(dirty, onDirty);
  const valid = ianaTimezoneSchema.safeParse(timezone).success;
  const canSave =
    dirty &&
    valid &&
    generationSettingsSchema.safeParse(generationSettings).success &&
    !save.isPending;
  const state = {
    generationSettings,
    busy: save.isPending,
    setGenerationSettings: (next: React.SetStateAction<GenerationSettings>) => {
      setSettings(typeof next === "function" ? next(generationSettings) : next);
      save.reset();
    },
  };
  function reset() {
    setTimezone(null);
    setSettings(null);
    save.reset();
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave)
          save.mutate(
            { timezone, defaultGenerationSettings: generationSettings },
            {
              onSuccess: () => {
                setTimezone(null);
                setSettings(null);
              },
            },
          );
      }}
    >
      <SettingsRow
        title="Zona waktu belajar"
        description="Menentukan pergantian hari untuk streak dan waktu yang ditampilkan di sini."
      >
        <Field>
          <FieldLabel htmlFor="timezone">Cari zona waktu</FieldLabel>
          <Input
            id="timezone"
            list="timezones"
            value={timezone}
            disabled={save.isPending}
            onChange={(event) => {
              setTimezone(event.target.value);
              save.reset();
            }}
            aria-invalid={!valid}
          />
          <datalist id="timezones">
            {Array.from(new Set([user.timezone, ...zones])).map((zone) => (
              <option key={zone} value={zone}>
                {zoneNames[zone] ?? zone.replaceAll("_", " ")}
              </option>
            ))}
          </datalist>
        </Field>
        <div className="flex flex-wrap gap-2">
          {Object.entries(zoneNames).map(([zone, label]) => (
            <Button
              type="button"
              key={zone}
              variant={timezone === zone ? "secondary" : "outline"}
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                setTimezone(zone);
                save.reset();
              }}
            >
              {label.split(" · ")[0]}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {zoneNames[timezone] ?? timezone.replaceAll("_", " ")}
        </p>
        {!valid && (
          <p role="alert" className="text-sm text-destructive">
            Pilih zona waktu yang valid.
          </p>
        )}
      </SettingsRow>
      <SettingsRow
        title="Default modul baru"
        description="Menjadi pilihan awal saat membuat modul. Kamu tetap bisa mengubahnya untuk setiap modul baru."
      >
        <BuilderLanguage state={state} />
        <BuilderGenerationSettings state={state} />
      </SettingsRow>
      <div className="flex flex-wrap gap-3 py-6">
        <Button type="submit" disabled={!canSave}>
          {save.isPending ? "Menyimpan…" : "Simpan perubahan"}
        </Button>
        <Button type="button" variant="outline" disabled={!dirty || save.isPending} onClick={reset}>
          Batal
        </Button>
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {settingsError(save.error)}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm text-primary">
          Preferensi belajar tersimpan.
        </p>
      )}
    </form>
  );
}
