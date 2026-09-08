import {
  type CreateModuleBodyInput,
  createModuleBodySchema,
  createPdfSourceFieldsSchema,
  createTextSourceBodySchema,
  createUrlSourceBodySchema,
  type GenerationSettings,
  generationSettingsSchema,
  MAX_PDF_SIZE_BYTES,
  type Source,
} from "@ngertiin/contracts/api";
import { useEffect, useRef, useState } from "react";

import { ApiProblemError } from "../../lib/api";
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
export type SourceCommand = {
  kind: "text" | "url" | "pdf";
  title: string;
  value: string;
  file?: File;
  key: string;
};
export type ModuleBuilderApi = {
  save: (command: SourceCommand) => Promise<Source>;
  create: (input: CreateModuleBodyInput, key: string) => Promise<void>;
};

export function useModuleBuilder(api: ModuleBuilderApi) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File>();
  const [instruction, setInstruction] = useState("");
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(() =>
    generationSettingsSchema.parse({}),
  );
  const [selected, setSelected] = useState<Selection[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const sourceCommands = useRef<SourceCommand[]>([]);
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
  async function save(kind: SourceCommand["kind"]) {
    const value = kind === "text" ? text : kind === "url" ? url : "";
    const commandFile = kind === "pdf" ? file : undefined;
    const fields = { ...(title.trim() ? { title } : {}) };
    const parsed =
      kind === "text"
        ? createTextSourceBodySchema.safeParse({ ...fields, text: value })
        : kind === "url"
          ? createUrlSourceBodySchema.safeParse({ ...fields, url: value })
          : createPdfSourceFieldsSchema.safeParse(fields);
    if (!parsed.success)
      throw new BuilderValidationError(parsed.error.issues[0]?.message ?? "Materi belum valid.");
    if (
      kind === "pdf" &&
      (!file ||
        file.size > MAX_PDF_SIZE_BYTES ||
        !file.size ||
        (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")))
    )
      throw new BuilderValidationError("Pilih PDF berukuran maksimal 25 MiB.");
    const previous = sourceCommands.current.find(
      (c) => c.kind === kind && c.title === title && c.value === value && c.file === commandFile,
    );
    const command = previous ?? { kind, title, value, file: commandFile, key: crypto.randomUUID() };
    if (!previous) sourceCommands.current.push(command);
    const source = await api.save(command);
    sourceCommands.current = sourceCommands.current.filter((item) => item !== command);
    return source;
  }
  async function add(kind: SourceCommand["kind"]) {
    if (lock.current) return;
    if (count >= 10) {
      setSourceError("Maksimum 10 materi.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setSourceError(null);
    try {
      const source = await save(kind);
      if (!alive.current) return;
      setSelected((current) =>
        current.some((item) => item.source.id === source.id)
          ? current
          : [...current, { source, role: current.length ? "reference" : "primary" }],
      );
      if (kind === "text") {
        setText("");
      }
      if (kind === "url") setUrl("");
      if (kind === "pdf") setFile(undefined);
      setTitle("");
      return true;
    } catch (error) {
      setSourceError(
        error instanceof ApiProblemError
          ? problemMessage(error)
          : error instanceof BuilderValidationError
            ? error.message
            : "Materi belum dapat ditambahkan. Periksa input dan koneksi, lalu coba lagi.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit() {
    if (lock.current || blocked) return;
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
    text,
    setText,
    title,
    setTitle,
    url,
    setUrl,
    file,
    setFile,
    instruction,
    setInstruction,
    generationSettings,
    setGenerationSettings,
    selected: resolved,
    busy,
    error,
    sourceError,
    setSourceError,
    blocked,
    count,
    toggle,
    role,
    add,
    submit,
    setStatuses,
    setSelected,
  };
}
export type ModuleBuilderState = ReturnType<typeof useModuleBuilder>;
