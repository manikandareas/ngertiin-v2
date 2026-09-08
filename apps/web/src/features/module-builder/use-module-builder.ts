import {
  type CreateModuleBodyInput,
  createModuleBodySchema,
  type GenerationSettings,
  generationSettingsSchema,
  type Source,
} from "@ngertiin/contracts/api";
import { useRef, useState } from "react";
import { ApiProblemError } from "../../lib/api";
import { type SourceCommand, useSourceForm } from "../sources/use-source-form";
import { formatUsageReset } from "../usage/usage-presentation";

function problemMessage(error: ApiProblemError) {
  return (
    error.problem.detail +
    (error.problem.resetAt ? ` Tersedia lagi ${formatUsageReset(error.problem.resetAt)}.` : "")
  );
}

class BuilderValidationError extends Error {}

export type Selection = {
  source: Source;
  role: "primary" | "reference" | "supplementary";
  selector?: { pages: { from: number; to: number } };
};
export type ModuleBuilderApi = {
  save: (command: SourceCommand) => Promise<Source>;
  create: (input: CreateModuleBodyInput, key: string) => Promise<void>;
};

export function useModuleBuilder(api: ModuleBuilderApi) {
  const [instruction, setInstruction] = useState("");
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(() =>
    generationSettingsSchema.parse({}),
  );
  const [selected, setSelected] = useState<Selection[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const form = useSourceForm(
    api.save,
    (source) => {
      setSelected((current) =>
        current.some((item) => item.source.id === source.id)
          ? current
          : [...current, { source, role: current.length ? "reference" : "primary" }],
      );
    },
    busy || selected.length >= 10,
  );
  const moduleCommand = useRef<{
    fingerprint: string;
    key: string;
    input: CreateModuleBodyInput;
  } | null>(null);
  const [statuses, setStatuses] = useState<Record<string, { source?: Source; error: boolean }>>({});
  const resolved = selected.map((item) => ({
    ...item,
    source: statuses[item.source.id]?.source ?? item.source,
  }));
  const count = selected.length;
  const blocked = getBlockedReason();

  function getBlockedReason(): string | null {
    if (!generationSettings.activityTypes.length) return "Pilih minimal satu jenis aktivitas.";
    if (count === 0) return "Tambahkan materi untuk mulai.";
    if (resolved.some((item) => item.source.archivedAt))
      return "Materi diarsipkan. Lepaskan dari board atau pulihkan di Materi saya.";
    if (count > 10) return "Maksimum 10 materi.";
    if (Array.from(instruction.trim()).length > 4_000)
      return "Fokus maksimal 4.000 karakter Unicode.";
    if (
      resolved.some(
        (item) =>
          !statuses[item.source.id]?.source ||
          statuses[item.source.id]?.error ||
          item.source.status !== "ready",
      )
    ) {
      return "Tunggu semua materi siap. Periksa status atau coba lagi jika gagal.";
    }
    for (const item of resolved) {
      if (!item.selector) continue;
      const { from, to } = item.selector.pages;
      if (
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 1 ||
        from > to ||
        to > (item.source.pageCount ?? 0)
      ) {
        return "Periksa rentang halaman PDF.";
      }
    }
    return null;
  }

  function toggle(source: Source) {
    setError(null);
    if (selected.some((item) => item.source.id === source.id)) {
      const next = selected.filter((item) => item.source.id !== source.id);
      if (next[0] && !next.some((item) => item.role === "primary"))
        next[0] = { ...next[0], role: "primary" };
      setSelected(next);
    } else if (count >= 10) setError("Maksimum 10 materi.");
    else setSelected([...selected, { source, role: selected.length ? "reference" : "primary" }]);
  }
  function role(id: string, role: Selection["role"]) {
    const next = selected.map((item) => (item.source.id === id ? { ...item, role } : item));
    if (!next.some((item) => item.role === "primary")) {
      setError("Setidaknya satu materi harus berperan Utama.");
      return;
    }
    setError(null);
    setSelected(next);
  }
  async function submit() {
    if (lock.current || form.busy || blocked) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const input: CreateModuleBodyInput = {
        generationSettings: generationSettingsSchema.parse(generationSettings),
        ...(instruction.trim() ? { instruction } : {}),
        sources: resolved.map(({ source, ...item }, index) => ({
          ...item,
          sourceId: source.id,
          priority: index + 1,
        })),
      };
      const parsed = createModuleBodySchema.safeParse(input);
      if (!parsed.success)
        throw new BuilderValidationError(parsed.error.issues[0]?.message ?? "Materi belum valid.");
      const fingerprint = JSON.stringify(parsed.data);
      if (moduleCommand.current?.fingerprint !== fingerprint)
        moduleCommand.current = { fingerprint, input, key: crypto.randomUUID() };
      await api.create(moduleCommand.current.input, moduleCommand.current.key);
    } catch (error) {
      setError(
        error instanceof ApiProblemError
          ? problemMessage(error)
          : error instanceof BuilderValidationError
            ? error.message
            : "Modul belum dapat dibuat. Draft tetap utuh; periksa koneksi, lalu coba lagi.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    ...form,
    instruction,
    setInstruction,
    generationSettings,
    setGenerationSettings,
    selected: resolved,
    busy: busy || form.busy,
    error,
    blocked,
    count,
    toggle,
    role,
    submit,
    setStatuses,
    setSelected,
  };
}
export type ModuleBuilderState = ReturnType<typeof useModuleBuilder>;
