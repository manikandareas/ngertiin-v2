import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CreatePracticeBody, LANGUAGE_OPTIONS, languageSchema } from "@ngertiin/contracts/api";
import { Button } from "../../../components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { practiceTypes } from "./practice-type-picker";

export type PracticeFormSettings = CreatePracticeBody["settings"];
export const practiceDifficultyLabels = {
  beginner: "Pemula",
  intermediate: "Menengah",
  advanced: "Lanjut",
} as const;

export function PracticeFormSettingsFields({
  settings,
  onChange,
  moduleTitle,
  disabled = false,
}: {
  settings: PracticeFormSettings;
  onChange: (settings: PracticeFormSettings) => void;
  moduleTitle: string;
  disabled?: boolean;
}) {
  const type = practiceTypes[settings.kind];
  const update = (patch: Partial<PracticeFormSettings>) => onChange({ ...settings, ...patch });
  return (
    <FieldGroup>
      <div className="rounded-xl border border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Materi dari modul</p>
        <p className="mt-1 text-sm font-medium">{moduleTitle}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Latihan juga akan tersimpan di modul ini.
        </p>
      </div>
      <Field>
        <FieldLabel htmlFor="practice-focus">
          Fokus latihan <span className="font-normal text-muted-foreground">(opsional)</span>
        </FieldLabel>
        <Textarea
          id="practice-focus"
          value={settings.focus}
          maxLength={2000}
          disabled={disabled}
          aria-describedby="practice-focus-help"
          placeholder="Misalnya: fokus pada konsep dasar dan soal penerapan."
          onChange={(event) => update({ focus: event.target.value })}
        />
        <FieldDescription id="practice-focus-help" className="text-xs">
          Kosongkan untuk mencakup seluruh materi modul.
        </FieldDescription>
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="practice-count">
            Jumlah {settings.kind === "flashcard" ? "kartu" : "soal"}
          </FieldLabel>
          <Input
            id="practice-count"
            type="number"
            min={type.min}
            max={type.max}
            disabled={disabled}
            aria-describedby="practice-count-help"
            value={settings.itemCount || ""}
            onChange={(event) => {
              const itemCount = Number(event.target.value);
              update({
                itemCount,
                composition: settings.composition
                  ? {
                      ...settings.composition,
                      multipleChoice: Math.max(
                        0,
                        itemCount -
                          settings.composition.trueFalse -
                          settings.composition.shortAnswer,
                      ),
                    }
                  : null,
              });
            }}
          />
          <FieldDescription id="practice-count-help" className="text-xs">
            {type.min}–{type.max} {settings.kind === "flashcard" ? "kartu" : "soal"}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="practice-difficulty">Tingkat kesulitan</FieldLabel>
          <Select
            disabled={disabled}
            value={settings.difficulty}
            onValueChange={(value) =>
              update({ difficulty: value as PracticeFormSettings["difficulty"] })
            }
          >
            <SelectTrigger
              id="practice-difficulty"
              className="w-full rounded-xl shadow-none data-[size=default]:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(practiceDifficultyLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {settings.kind === "exam" ? (
          <Field>
            <FieldLabel htmlFor="practice-duration">Durasi (menit)</FieldLabel>
            <Input
              id="practice-duration"
              type="number"
              min={20}
              max={180}
              disabled={disabled}
              aria-describedby="practice-duration-help"
              value={settings.durationMinutes ?? ""}
              onChange={(event) => update({ durationMinutes: Number(event.target.value) })}
            />
            <FieldDescription id="practice-duration-help" className="text-xs">
              20–180 menit
            </FieldDescription>
          </Field>
        ) : null}
      </div>
      <Collapsible disabled={disabled} className="rounded-xl border border-border">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="group min-h-14 w-full justify-between rounded-xl px-4 py-3 text-sm normal-case tracking-normal"
          >
            Pengaturan tambahan
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-muted-foreground motion-safe:transition-transform group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <FieldGroup className="gap-5 border-t px-4 py-5 sm:px-5">
            <Field>
              <FieldLabel htmlFor="practice-language">Bahasa latihan</FieldLabel>
              <Select
                disabled={disabled}
                value={settings.language}
                onValueChange={(value) => update({ language: languageSchema.parse(value) })}
              >
                <SelectTrigger
                  id="practice-language"
                  className="w-full rounded-xl shadow-none data-[size=default]:h-11"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageSchema.options.map((language) => (
                    <SelectItem
                      key={language}
                      value={language}
                      textValue={LANGUAGE_OPTIONS[language].label}
                    >
                      <span aria-hidden="true">{LANGUAGE_OPTIONS[language].flag}</span>
                      {LANGUAGE_OPTIONS[language].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {settings.composition ? (
              <FieldSet className="gap-3">
                <FieldLegend variant="label">Komposisi soal</FieldLegend>
                <FieldDescription className="text-xs">
                  Sisa soal menjadi pilihan ganda. Total harus sesuai jumlah soal.
                </FieldDescription>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["trueFalse", "Benar / salah"],
                      ["shortAnswer", "Jawaban singkat"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key}>
                      <FieldLabel htmlFor={`practice-${key}`} className="text-xs">
                        {label}
                      </FieldLabel>
                      <Input
                        id={`practice-${key}`}
                        type="number"
                        min={0}
                        disabled={disabled}
                        max={
                          key === "shortAnswer"
                            ? settings.kind === "quiz"
                              ? 5
                              : 10
                            : settings.itemCount
                        }
                        value={settings.composition?.[key] ?? 0}
                        onChange={(event) => {
                          if (!settings.composition) return;
                          const composition = {
                            ...settings.composition,
                            [key]: Number(event.target.value),
                          };
                          composition.multipleChoice = Math.max(
                            0,
                            settings.itemCount - composition.trueFalse - composition.shortAnswer,
                          );
                          update({ composition });
                        }}
                      />
                    </Field>
                  ))}
                </div>
                <FieldDescription className="text-xs">
                  Pilihan ganda: {settings.composition.multipleChoice} soal
                </FieldDescription>
              </FieldSet>
            ) : null}
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>
    </FieldGroup>
  );
}
