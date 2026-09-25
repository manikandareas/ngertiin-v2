import type { PracticeConfiguration, RespondChatInteraction } from "@ngertiin/contracts/api";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "../../../components/ui/button";
import type { useModules } from "../../modules/api/use-modules";

const actionClass =
  "h-9 rounded-full border px-3 text-sm font-semibold normal-case tracking-normal shadow-none active:translate-y-0";
const fieldClass =
  "w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";

type ChatPracticeSettingsProps = {
  config: PracticeConfiguration;
  setConfig: Dispatch<SetStateAction<PracticeConfiguration | undefined>>;
  busy: boolean;
  revision: string;
  setRevision: (value: string) => void;
  modules: ReturnType<typeof useModules>;
  submit: (decision: RespondChatInteraction) => Promise<void>;
};

export function ChatPracticeSettings({
  config,
  setConfig,
  busy,
  revision,
  setRevision,
  modules,
  submit,
}: ChatPracticeSettingsProps) {
  const available = modules.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <fieldset disabled={busy} className="grid min-w-0 gap-4 border-t border-border bg-muted/30 p-5">
      <legend className="sr-only">Pengaturan latihan</legend>
      <label className="grid gap-1">
        Judul
        <input
          className={fieldClass}
          value={config.title}
          onChange={(event) => setConfig({ ...config, title: event.target.value })}
        />
      </label>
      <label className="grid gap-1">
        Modul tujuan
        <select
          className={fieldClass}
          value={config.destinationModuleId}
          onChange={(event) => setConfig({ ...config, destinationModuleId: event.target.value })}
        >
          {available.map((module) => (
            <option key={module.id} value={module.id}>
              {module.title}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-1">
        <legend>Sumber modul</legend>
        {available.map((module) => (
          <label key={module.id} className="flex min-h-9 items-center gap-2">
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-[var(--ring)]"
              checked={config.sources.some(
                (source) => source.kind === "module" && source.moduleId === module.id,
              )}
              onChange={(event) =>
                setConfig((old) => {
                  if (!old) return old;
                  const sources = old.sources.filter(
                    (source) => source.kind !== "module" || source.moduleId !== module.id,
                  );
                  return {
                    ...old,
                    sources: event.target.checked
                      ? [...sources, { kind: "module" as const, moduleId: module.id }]
                      : sources,
                  };
                })
              }
            />
            {module.title}
          </label>
        ))}
      </fieldset>
      {modules.hasNextPage ? (
        <Button
          size="sm"
          variant="outline"
          disabled={modules.isFetchingNextPage}
          onClick={() => void modules.fetchNextPage()}
        >
          {modules.isFetchingNextPage ? "Memuat modul…" : "Tampilkan modul lain"}
        </Button>
      ) : null}
      <label className="grid gap-1">
        Bahasa
        <select
          className={fieldClass}
          value={config.language}
          onChange={(event) =>
            setConfig({ ...config, language: event.target.value as typeof config.language })
          }
        >
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="grid gap-1">
        Kesulitan
        <select
          className={fieldClass}
          value={config.difficulty}
          onChange={(event) =>
            setConfig({
              ...config,
              difficulty: event.target.value as typeof config.difficulty,
            })
          }
        >
          <option value="beginner">Pemula</option>
          <option value="intermediate">Menengah</option>
          <option value="advanced">Lanjutan</option>
        </select>
      </label>
      <label className="grid gap-1">
        Jumlah
        <input
          type="number"
          className={fieldClass}
          value={config.itemCount}
          onChange={(event) => setConfig({ ...config, itemCount: Number(event.target.value) })}
        />
      </label>
      {config.composition ? (
        <div className="grid grid-cols-3 gap-2">
          {(["multipleChoice", "trueFalse", "shortAnswer"] as const).map((key) => (
            <label key={key} className="grid gap-1 text-xs">
              {key === "multipleChoice"
                ? "Pilihan ganda"
                : key === "trueFalse"
                  ? "Benar/salah"
                  : "Esai"}
              <input
                type="number"
                min="0"
                className={fieldClass}
                value={config.composition?.[key] ?? 0}
                onChange={(event) =>
                  setConfig((old) =>
                    old?.composition
                      ? {
                          ...old,
                          composition: {
                            ...old.composition,
                            [key]: Number(event.target.value),
                          },
                        }
                      : old,
                  )
                }
              />
            </label>
          ))}
        </div>
      ) : null}
      {config.kind === "exam" ? (
        <label className="grid gap-1">
          Durasi (menit)
          <input
            type="number"
            className={fieldClass}
            value={config.durationMinutes ?? ""}
            onChange={(event) =>
              setConfig({ ...config, durationMinutes: Number(event.target.value) })
            }
          />
        </label>
      ) : null}
      <label className="grid gap-1">
        Ubah fokus atau beri instruksi tambahan
        <textarea
          className={fieldClass}
          value={revision}
          onChange={(event) => setRevision(event.target.value)}
          placeholder="Contoh: hanya gunakan materi dari modul Biologi"
        />
      </label>
      {revision.trim() ? (
        <Button
          size="sm"
          variant="outline"
          className={actionClass}
          disabled={busy}
          onClick={() =>
            void submit({
              decision: "revise",
              responseId: crypto.randomUUID(),
              instruction: revision.trim(),
            })
          }
        >
          Kirim revisi
        </Button>
      ) : null}
    </fieldset>
  );
}
