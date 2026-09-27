import { ArrowLeft01Icon, ArrowRight01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type CreatePracticeBody,
  createPracticeBodySchema,
  LANGUAGE_OPTIONS,
} from "@ngertiin/contracts/api";
import { useRef, useState } from "react";
import { CreationLayout } from "../../components/creation-layout";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel, FieldSet } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { ApiProblemError } from "../../lib/api";
import {
  type PracticeFormSettings,
  PracticeFormSettingsFields,
  practiceDifficultyLabels,
} from "./components/practice-form-settings";
import { PracticeTypePicker, practiceTypes } from "./components/practice-type-picker";

export const practiceCreationSteps = ["Jenis latihan", "Pengaturan", "Tinjau latihan"];
const headings = ["Mau latihan dengan cara apa?", "Atur latihanmu", "Tinjau latihan"];
const descriptions = [
  "Pilih cara yang paling cocok untuk belajarmu hari ini.",
  "Beri sedikit arahan agar latihan sesuai kebutuhanmu.",
  "Pastikan pengaturannya sudah sesuai sebelum latihan dibuat.",
];

export function PracticeCreateForm({
  moduleId,
  moduleTitle,
  onCreate,
}: {
  moduleId: string;
  moduleTitle: string;
  onCreate: (body: CreatePracticeBody) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<PracticeFormSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submission = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const inFlight = useRef(false);
  const go = (next: number) => {
    setError(null);
    setStep(next);
  };
  const normalized = settings
    ? {
        ...settings,
        title:
          settings.title.trim() ||
          (step < 2 ? `${practiceTypes[settings.kind].label} · ${moduleTitle}`.slice(0, 120) : ""),
        focus:
          settings.focus.trim() || "Latihan mencakup konsep penting dari seluruh materi modul.",
      }
    : null;
  function validate() {
    if (normalized && !normalized.title) {
      setError("Isi judul latihan terlebih dahulu.");
      return null;
    }
    const result = createPracticeBodySchema.safeParse({
      requestId: "00000000-0000-4000-8000-000000000000",
      settings: normalized,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Periksa kembali pengaturan latihan.");
      return null;
    }
    return result.data.settings;
  }
  async function submit() {
    if (inFlight.current) return;
    const validated = validate();
    if (!validated) return;
    const fingerprint = JSON.stringify(validated);
    if (submission.current?.fingerprint !== fingerprint)
      submission.current = { fingerprint, requestId: crypto.randomUUID() };
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ requestId: submission.current.requestId, settings: validated });
    } catch (cause) {
      setError(
        cause instanceof ApiProblemError
          ? cause.message
          : "Latihan belum dapat dibuat. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <CreationLayout
      steps={practiceCreationSteps}
      step={step}
      onStep={busy ? undefined : go}
      title={headings[step]}
      description={descriptions[step]}
      backTo={`/modules/${moduleId}/practice`}
      backLabel="Kembali ke latihan"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 2) void submit();
          else if (step === 0 ? !!settings : !!validate()) go(step + 1);
        }}
      >
        <FieldSet disabled={busy} className="min-w-0">
          {step === 0 ? (
            <PracticeTypePicker
              value={settings?.kind ?? null}
              disabled={busy}
              onChange={(kind) => {
                if (settings?.kind === kind) return;
                const type = practiceTypes[kind];
                setError(null);
                setSettings({
                  kind,
                  title: `${type.label} · ${moduleTitle}`.slice(0, 120),
                  focus: settings?.focus ?? "",
                  language: settings?.language ?? "id",
                  difficulty: settings?.difficulty ?? "beginner",
                  itemCount: type.count,
                  composition:
                    kind === "flashcard"
                      ? null
                      : { multipleChoice: type.count, trueFalse: 0, shortAnswer: 0 },
                  durationMinutes: kind === "exam" ? 30 : null,
                });
              }}
            />
          ) : settings && step === 1 ? (
            <PracticeFormSettingsFields
              settings={settings}
              disabled={busy}
              moduleTitle={moduleTitle}
              onChange={(next) => {
                setSettings(next);
                setError(null);
              }}
            />
          ) : settings ? (
            <div className="space-y-6">
              <Field>
                <FieldLabel htmlFor="practice-title" className="text-sm font-medium">
                  Judul latihan
                </FieldLabel>
                <Input
                  id="practice-title"
                  required
                  maxLength={120}
                  value={settings.title}
                  onChange={(event) => setSettings({ ...settings, title: event.target.value })}
                />
              </Field>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-4 rounded-xl border border-border p-5 text-sm">
                <dt className="text-muted-foreground">Jenis</dt>
                <dd>{practiceTypes[settings.kind].label}</dd>
                <dt className="text-muted-foreground">Materi</dt>
                <dd className="break-words">{moduleTitle}</dd>
                <dt className="text-muted-foreground">Fokus</dt>
                <dd className="break-words">{settings.focus.trim() || "Seluruh materi modul"}</dd>
                <dt className="text-muted-foreground">Jumlah</dt>
                <dd>
                  {settings.itemCount} {settings.kind === "flashcard" ? "kartu" : "soal"}
                </dd>
                <dt className="text-muted-foreground">Kesulitan</dt>
                <dd>{practiceDifficultyLabels[settings.difficulty]}</dd>
                <dt className="text-muted-foreground">Bahasa</dt>
                <dd>{LANGUAGE_OPTIONS[settings.language].label}</dd>
                {settings.durationMinutes !== null ? (
                  <>
                    <dt className="text-muted-foreground">Durasi</dt>
                    <dd>{settings.durationMinutes} menit</dd>
                  </>
                ) : null}
                {settings.composition ? (
                  <>
                    <dt className="text-muted-foreground">Komposisi</dt>
                    <dd>
                      {settings.composition.multipleChoice} pilihan ganda ·{" "}
                      {settings.composition.trueFalse} benar/salah ·{" "}
                      {settings.composition.shortAnswer} jawaban singkat
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
          ) : null}
        </FieldSet>
        {error ? (
          <p role="alert" className="mt-5 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <footer className="mt-10 flex items-center justify-between gap-4 border-t border-muted pt-6 sm:mt-12">
          {step > 0 ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => go(step - 1)}>
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} aria-hidden="true" />
              Kembali
            </Button>
          ) : null}
          <Button type="submit" disabled={busy || !settings} className="ml-auto">
            {busy
              ? "Menyiapkan…"
              : step === 2 && settings
                ? `Buat ${practiceTypes[settings.kind].label.toLowerCase()}`
                : "Lanjut"}
            <HugeiconsIcon
              icon={step === 2 ? SparklesIcon : ArrowRight01Icon}
              size={16}
              aria-hidden="true"
            />
          </Button>
        </footer>
      </form>
    </CreationLayout>
  );
}
