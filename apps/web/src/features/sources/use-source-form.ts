import {
  createPdfSourceFieldsSchema,
  createTextSourceBodySchema,
  createUrlSourceBodySchema,
  MAX_PDF_SIZE_BYTES,
  type Source,
} from "@ngertiin/contracts/api";
import { useEffect, useRef, useState } from "react";
import { ApiProblemError } from "../../lib/api";
import { formatUsageReset } from "../usage/usage-presentation";

class SourceValidationError extends Error {}
function problemMessage(error: ApiProblemError) {
  return (
    error.problem.detail +
    (error.problem.resetAt ? ` Tersedia lagi ${formatUsageReset(error.problem.resetAt)}.` : "")
  );
}
export type SourceCommand = {
  kind: "text" | "url" | "pdf";
  title: string;
  value: string;
  file?: File;
  key: string;
};

export function useSourceForm(
  persist: (command: SourceCommand) => Promise<Source>,
  onSuccess?: (source: Source) => void,
  disabled = false,
) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const sourceCommands = useRef<SourceCommand[]>([]);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
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
      throw new SourceValidationError(parsed.error.issues[0]?.message ?? "Materi belum valid.");
    if (
      kind === "pdf" &&
      (!file ||
        file.size > MAX_PDF_SIZE_BYTES ||
        !file.size ||
        (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")))
    )
      throw new SourceValidationError("Pilih PDF berukuran maksimal 25 MiB.");
    const previous = sourceCommands.current.find(
      (c) => c.kind === kind && c.title === title && c.value === value && c.file === commandFile,
    );
    const command = previous ?? { kind, title, value, file: commandFile, key: crypto.randomUUID() };
    if (!previous) sourceCommands.current.push(command);
    const source = await persist(command);
    sourceCommands.current = sourceCommands.current.filter((item) => item !== command);
    return source;
  }
  async function add(kind: SourceCommand["kind"]) {
    if (lock.current) return;
    if (disabled) {
      setSourceError("Penambahan materi belum tersedia.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setSourceError(null);
    try {
      const source = await save(kind);
      if (!alive.current) return;
      onSuccess?.(source);
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
          : error instanceof SourceValidationError
            ? error.message
            : "Materi belum dapat ditambahkan. Periksa input dan koneksi, lalu coba lagi.",
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
    busy,
    sourceError,
    setSourceError,
    add,
  };
}
export type SourceFormState = ReturnType<typeof useSourceForm>;
