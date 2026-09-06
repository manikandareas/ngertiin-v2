import {
  type CreateModuleBodyInput,
  createModuleBodySchema,
  createPdfSourceFieldsSchema,
  createTextSourceBodySchema,
  createUrlSourceBodySchema,
  MAX_PDF_SIZE_BYTES,
  type Source,
} from "@ngertiin/contracts/api";
import { useEffect, useRef, useState } from "react";

class ComposerValidationError extends Error {}

export type ComposerPanelName = "pdf" | "url" | "library" | "focus" | "manage";

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
export type ComposerApi = {
  save: (command: SourceCommand) => Promise<Source>;
  create: (input: CreateModuleBodyInput, key: string) => Promise<void>;
};

export function useComposer(api: ComposerApi) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File>();
  const [instruction, setInstruction] = useState("");
  const [panel, setPanel] = useState<ComposerPanelName | null>(null);
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
  const savedText = useRef<{ text: string; title: string; source: Source } | null>(null);
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
  const count = selected.length + (text.trim() ? 1 : 0);
  const blocked = getBlockedReason();

  function getBlockedReason(): string | null {
    if (count === 0) return "Tambahkan materi untuk mulai.";
    if (count > 10) return "Maksimum 10 materi, termasuk teks di atas.";
    if (Array.from(text.trim()).length > 100_000) return "Teks maksimal 100.000 karakter Unicode.";
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
    } else if (count >= 10) setError("Maksimum 10 materi, termasuk teks di atas.");
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
  function move(index: number, direction: number) {
    const next = [...selected];
    const item = next[index];
    const other = next[index + direction];
    if (!item || !other) return;
    next[index] = other;
    next[index + direction] = item;
    setSelected(next);
  }
  async function save(kind: SourceCommand["kind"]) {
    if (kind === "text" && savedText.current?.text === text && savedText.current.title === title)
      return savedText.current.source;
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
      throw new ComposerValidationError(parsed.error.issues[0]?.message ?? "Materi belum valid.");
    if (
      kind === "pdf" &&
      (!file ||
        file.size > MAX_PDF_SIZE_BYTES ||
        !file.size ||
        (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")))
    )
      throw new ComposerValidationError("Pilih PDF berukuran maksimal 25 MiB.");
    const previous = sourceCommands.current.find(
      (c) => c.kind === kind && c.title === title && c.value === value && c.file === commandFile,
    );
    const command = previous ?? { kind, title, value, file: commandFile, key: crypto.randomUUID() };
    if (!previous) sourceCommands.current.push(command);
    const source = await api.save(command);
    if (kind === "text") savedText.current = { text, title, source };
    sourceCommands.current = sourceCommands.current.filter((item) => item !== command);
    return source;
  }
  async function add(kind: SourceCommand["kind"]) {
    if (lock.current) return;
    if (count + (kind === "text" && text.trim() ? 0 : 1) > 10) {
      setSourceError("Maksimum 10 materi, termasuk teks di atas.");
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
        savedText.current = null;
      }
      if (kind === "url") setUrl("");
      if (kind === "pdf") setFile(undefined);
      setTitle("");
    } catch (error) {
      setSourceError(
        error instanceof ComposerValidationError
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
      let items = resolved;
      if (text.trim()) {
        const source = await save("text");
        if (!alive.current) return;
        items = [...items, { source, role: items.length ? "reference" : "primary" }];
        if (source.status !== "ready")
          throw new ComposerValidationError("Materi belum siap. Tunggu pemrosesan selesai.");
      }
      const input: CreateModuleBodyInput = {
        ...(instruction.trim() ? { instruction } : {}),
        sources: items.map(({ source, ...item }, index) => ({
          ...item,
          sourceId: source.id,
          priority: index + 1,
        })),
      };
      const parsed = createModuleBodySchema.safeParse(input);
      if (!parsed.success)
        throw new ComposerValidationError(parsed.error.issues[0]?.message ?? "Materi belum valid.");
      const fingerprint = JSON.stringify(input);
      if (moduleCommand.current?.fingerprint !== fingerprint)
        moduleCommand.current = { fingerprint, input, key: crypto.randomUUID() };
      await api.create(moduleCommand.current.input, moduleCommand.current.key);
    } catch (error) {
      setError(
        error instanceof ComposerValidationError
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
    panel,
    setPanel,
    selected: resolved,
    busy,
    error,
    sourceError,
    blocked,
    count,
    toggle,
    role,
    move,
    add,
    submit,
    setStatuses,
    setSelected,
  };
}
export type ComposerState = ReturnType<typeof useComposer>;
