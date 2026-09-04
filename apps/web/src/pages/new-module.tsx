import { useAuth } from "@clerk/react";
import {
  type CreateModuleBodyInput,
  type CreatePdfSourceFieldsInput,
  createModuleBodySchema,
  type CreateTextSourceBodyInput,
  type CreateUrlSourceBodyInput,
  MAX_PDF_SIZE_BYTES,
  type Source,
} from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Link,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { useCreateModule } from "../features/modules/api/use-modules";
import {
  sourcesQueryRootKey,
  useCreatePdfSource,
  useCreateTextSource,
  useCreateUrlSource,
  useRetrySource,
  useSources,
} from "../features/sources/api/use-sources";
import { ApiProblemError } from "../lib/api";

type SourceInputKind = "text" | "url" | "pdf";
type RetriableSourceCommand =
  | { kind: "text"; key: string; title: string; text: string }
  | { kind: "url"; key: string; title: string; url: string }
  | { kind: "pdf"; key: string; title: string; file: File };
type SelectedSource = {
  sourceId: string;
  role: "primary" | "reference" | "supplementary";
  selector?: { pages: { from: number; to: number } };
};
type RetriableModuleCommand = { key: string; fingerprint: string; input: CreateModuleBodyInput };
type SourceOptionProps = {
  source: Source;
  selection: SelectedSource | undefined;
  index: number;
  total: number;
  onToggle: () => void;
  onRoleChange: (role: SelectedSource["role"]) => void;
  onMove: (direction: -1 | 1) => void;
  onPageRangeChange: (range: { from: number; to: number } | undefined) => void;
  onRetry: () => void;
  retryError: string | null;
  retrying: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fieldMessage(error: unknown, path: string): string | undefined {
  if (!(error instanceof ApiProblemError)) return undefined;
  return error.problem.errors?.find((fieldError) => fieldError.path === path)?.message;
}

const sourceTypeLabels: Record<Source["type"], string> = {
  text: "Teks",
  pdf: "PDF",
  url: "URL",
};

const sourceStatusLabels: Record<Source["status"], string> = {
  pending: "Menunggu diproses",
  processing: "Sedang diproses",
  ready: "Siap dipakai",
  failed: "Gagal diproses",
};

function mutationErrorMessage(error: unknown, isError: boolean, fallback: string): string | null {
  if (error instanceof ApiProblemError) return error.problem.detail;
  return isError ? fallback : null;
}

function SourceOption({
  source,
  selection,
  index,
  total,
  onToggle,
  onRoleChange,
  onMove,
  onPageRangeChange,
  onRetry,
  retryError,
  retrying,
}: SourceOptionProps) {
  const selectable = source.status === "ready";
  const pageCount = source.pageCount ?? 1;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-300">
      <label className={selectable ? "flex cursor-pointer gap-4" : "flex cursor-not-allowed gap-4"}>
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-slate-300 bg-white text-white has-[:checked]:border-teal-600 has-[:checked]:bg-teal-600">
          <input
            checked={selection !== undefined}
            className="sr-only"
            disabled={!selectable}
            onChange={onToggle}
            type="checkbox"
          />
          {selection ? <Check aria-hidden="true" className="size-3.5" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {source.title ?? "Materi tanpa judul"}
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            {sourceTypeLabels[source.type]} · {sourceStatusLabels[source.status]} ·{" "}
            {dateFormatter.format(new Date(source.createdAt))}
          </span>
          {source.type === "pdf" && source.pageCount ? (
            <span className="mt-1 block text-xs text-slate-500">{source.pageCount} halaman</span>
          ) : null}
          {source.status === "pending" || source.status === "processing" ? (
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              Status diperbarui otomatis
            </span>
          ) : null}
        </span>
      </label>
      {source.status === "failed" && source.failure ? (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <p>{source.failure.message}</p>
          {source.failure.retryable ? (
            <Button
              className="mt-3 gap-2"
              disabled={retrying}
              onClick={onRetry}
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={retrying ? "size-4 animate-spin" : "size-4"}
              />
              {retrying ? "Mengirim…" : "Coba proses lagi"}
            </Button>
          ) : null}
          {retryError ? (
            <p className="mt-2 text-xs" role="alert">
              {retryError}
            </p>
          ) : null}
        </div>
      ) : null}
      {selection ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Prioritas {index + 1}
          </span>
          <select
            aria-label={`Peran ${source.title ?? "Source"}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => onRoleChange(event.target.value as SelectedSource["role"])}
            value={selection.role}
          >
            <option value="primary">Primary</option>
            <option value="reference">Reference</option>
            <option value="supplementary">Supplementary</option>
          </select>
          <div className="ml-auto flex gap-2">
            <Button
              aria-label="Naikkan prioritas"
              className="size-9 p-0"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              type="button"
              variant="outline"
            >
              <ChevronUp aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Turunkan prioritas"
              className="size-9 p-0"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              type="button"
              variant="outline"
            >
              <ChevronDown aria-hidden="true" className="size-4" />
            </Button>
          </div>
          {source.type === "pdf" ? (
            <div className="w-full border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  checked={selection.selector !== undefined}
                  onChange={(event) =>
                    onPageRangeChange(event.target.checked ? { from: 1, to: pageCount } : undefined)
                  }
                  type="checkbox"
                />
                Gunakan rentang halaman tertentu
              </label>
              {selection.selector ? (
                <div className="mt-3 flex items-center gap-3">
                  <label
                    className="text-xs font-semibold text-slate-600"
                    htmlFor={`from-${source.id}`}
                  >
                    Dari
                  </label>
                  <input
                    className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    id={`from-${source.id}`}
                    max={pageCount}
                    min={1}
                    onChange={(event) =>
                      onPageRangeChange({
                        from: Number(event.target.value),
                        to: selection.selector?.pages.to ?? pageCount,
                      })
                    }
                    type="number"
                    value={selection.selector.pages.from}
                  />
                  <label
                    className="text-xs font-semibold text-slate-600"
                    htmlFor={`to-${source.id}`}
                  >
                    Sampai
                  </label>
                  <input
                    className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    id={`to-${source.id}`}
                    max={pageCount}
                    min={1}
                    onChange={(event) =>
                      onPageRangeChange({
                        from: selection.selector?.pages.from ?? 1,
                        to: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={selection.selector.pages.to}
                  />
                  <span className="text-xs text-slate-500">dari {pageCount}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function NewModulePage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sourcesQuery = useSources({ limit: 20 });
  const createTextSource = useCreateTextSource();
  const createUrlSource = useCreateUrlSource();
  const createPdfSource = useCreatePdfSource();
  const retrySource = useRetrySource();
  const createModule = useCreateModule();
  const [sourceInputKind, setSourceInputKind] = useState<SourceInputKind>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfInputVersion, setPdfInputVersion] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [sourceRetry, setSourceRetry] = useState<RetriableSourceCommand | null>(null);
  const [processingRetryKeys, setProcessingRetryKeys] = useState<Record<string, string>>({});
  const [moduleRetry, setModuleRetry] = useState<RetriableModuleCommand | null>(null);
  const [moduleValidationError, setModuleValidationError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<SelectedSource[]>([]);
  const sources = sourcesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const selectedIndex = new Map(selectedSources.map((source, index) => [source.sourceId, index]));
  const activeSourceMutation = {
    text: createTextSource,
    url: createUrlSource,
    pdf: createPdfSource,
  }[sourceInputKind];
  const titleError = fieldMessage(activeSourceMutation.error, "title");
  const textError = fieldMessage(createTextSource.error, "text");
  const urlError = fieldMessage(createUrlSource.error, "url");
  const pdfError = fieldMessage(createPdfSource.error, "file");
  const sourceError = mutationErrorMessage(
    activeSourceMutation.error,
    activeSourceMutation.isError,
    "Source belum dapat dibuat. Periksa koneksi lalu coba lagi.",
  );
  const moduleError = mutationErrorMessage(
    createModule.error,
    createModule.isError,
    "Module belum dapat dibuat. Periksa koneksi lalu coba lagi.",
  );
  let sourceSubmitLabel = sourceInputKind === "text" ? "Simpan Source" : "Tambahkan Source";
  if (activeSourceMutation.isPending) {
    sourceSubmitLabel = sourceInputKind === "text" ? "Menyimpan…" : "Mengunggah…";
  } else if (activeSourceMutation.isError) {
    sourceSubmitLabel = "Coba lagi";
  }

  let moduleSubmitLabel = "Generate Module";
  if (createModule.isPending) moduleSubmitLabel = "Mengirim…";
  else if (createModule.isError) moduleSubmitLabel = "Coba lagi";

  let pdfMessage = "Maksimum 25 MiB. PDF diproses per halaman.";
  let pdfMessageClass = "mt-2 text-sm text-slate-500";
  if (pdfError) {
    pdfMessage = pdfError;
    pdfMessageClass = "mt-2 text-sm text-red-700";
  } else if (pdf && pdf.size > MAX_PDF_SIZE_BYTES) {
    pdfMessage = "File melebihi batas 25 MiB.";
    pdfMessageClass = "mt-2 text-sm text-red-700";
  }

  function invalidateModuleCommand(): void {
    setModuleRetry(null);
    setModuleValidationError(null);
    if (createModule.isError || createModule.isSuccess) createModule.reset();
  }

  function resetSourceMutations(): void {
    createTextSource.reset();
    createUrlSource.reset();
    createPdfSource.reset();
  }

  function changeSourceInputKind(kind: SourceInputKind): void {
    setSourceInputKind(kind);
    setSourceRetry(null);
    resetSourceMutations();
  }

  async function handleSourceSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    let command: RetriableSourceCommand;
    if (sourceInputKind === "text") {
      command =
        sourceRetry?.kind === "text" && sourceRetry.title === title && sourceRetry.text === text
          ? sourceRetry
          : { kind: "text", key: crypto.randomUUID(), title, text };
    } else if (sourceInputKind === "url") {
      command =
        sourceRetry?.kind === "url" && sourceRetry.title === title && sourceRetry.url === url
          ? sourceRetry
          : { kind: "url", key: crypto.randomUUID(), title, url };
    } else {
      if (!pdf) return;
      command =
        sourceRetry?.kind === "pdf" && sourceRetry.title === title && sourceRetry.file === pdf
          ? sourceRetry
          : { kind: "pdf", key: crypto.randomUUID(), title, file: pdf };
    }
    setSourceRetry(command);
    try {
      let source: Source;
      if (command.kind === "text") {
        const input: CreateTextSourceBodyInput = {
          ...(command.title.length > 0 ? { title: command.title } : {}),
          text: command.text,
        };
        source = await createTextSource.mutateAsync({ input, key: command.key });
      } else if (command.kind === "url") {
        const input: CreateUrlSourceBodyInput = {
          ...(command.title.length > 0 ? { title: command.title } : {}),
          url: command.url,
        };
        source = await createUrlSource.mutateAsync({ input, key: command.key });
      } else {
        const fields: CreatePdfSourceFieldsInput = {
          ...(command.title.length > 0 ? { title: command.title } : {}),
        };
        source = await createPdfSource.mutateAsync({
          fields,
          file: command.file,
          key: command.key,
        });
      }
      if (source.status === "ready") {
        setSelectedSources((current) =>
          current.some((selected) => selected.sourceId === source.id)
            ? current
            : [
                ...current,
                { sourceId: source.id, role: current.length === 0 ? "primary" : "reference" },
              ],
        );
      }
      setTitle("");
      setText("");
      setUrl("");
      setPdf(null);
      setPdfInputVersion((current) => current + 1);
      setSourceRetry(null);
      invalidateModuleCommand();
      await queryClient.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
    } catch {
      // Mutation state renders the safe error and preserves the command key.
    }
  }

  async function handleProcessingRetry(sourceId: string): Promise<void> {
    const key = processingRetryKeys[sourceId] ?? crypto.randomUUID();
    setProcessingRetryKeys((current) => ({ ...current, [sourceId]: key }));
    try {
      await retrySource.mutateAsync({ sourceId, key });
      setProcessingRetryKeys((current) => {
        const next = { ...current };
        delete next[sourceId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
    } catch {
      // The safe failure remains visible and the same idempotency key is reused.
    }
  }

  function toggleSource(sourceId: string): void {
    setSelectedSources((current) => {
      const existing = current.findIndex((source) => source.sourceId === sourceId);
      if (existing >= 0) return current.filter((source) => source.sourceId !== sourceId);
      return [...current, { sourceId, role: current.length === 0 ? "primary" : "reference" }];
    });
    invalidateModuleCommand();
  }

  function updateRole(sourceId: string, role: SelectedSource["role"]): void {
    setSelectedSources((current) =>
      current.map((source) => (source.sourceId === sourceId ? { ...source, role } : source)),
    );
    invalidateModuleCommand();
  }

  function updatePageRange(
    sourceId: string,
    range: { from: number; to: number } | undefined,
  ): void {
    setSelectedSources((current) =>
      current.map((source) => {
        if (source.sourceId !== sourceId) return source;
        return { ...source, selector: range ? { pages: range } : undefined };
      }),
    );
    invalidateModuleCommand();
  }

  function moveSource(sourceId: string, direction: -1 | 1): void {
    setSelectedSources((current) => {
      const index = current.findIndex((source) => source.sourceId === sourceId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target] as SelectedSource, next[index] as SelectedSource];
      return next;
    });
    invalidateModuleCommand();
  }

  async function handleModuleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const input: CreateModuleBodyInput = {
      ...(instruction.trim() ? { instruction } : {}),
      sources: selectedSources.map((source, index) => ({ ...source, priority: index + 1 })),
    };
    const parsed = createModuleBodySchema.safeParse(input);
    if (!parsed.success) {
      setModuleValidationError(parsed.error.issues[0]?.message ?? "Pilihan Source belum valid.");
      return;
    }
    const fingerprint = JSON.stringify(parsed.data);
    const command =
      moduleRetry?.fingerprint === fingerprint
        ? moduleRetry
        : { key: crypto.randomUUID(), fingerprint, input };
    setModuleRetry(command);
    setModuleValidationError(null);
    try {
      const result = await createModule.mutateAsync({ input: command.input, key: command.key });
      navigate(`/modules/${result.module.id}`);
    } catch {
      // Mutation state renders the safe error and preserves the exact command key and payload.
    }
  }

  function renderSourceOptions(): ReactNode {
    if (sourcesQuery.isPending) {
      return <p className="mt-8 text-sm text-slate-500">Memuat Source…</p>;
    }
    if (sourcesQuery.isError && sources.length === 0) {
      return (
        <div className="mt-8">
          <p className="text-sm text-red-700">Source library belum dapat dimuat.</p>
          <Button className="mt-4" onClick={() => sourcesQuery.refetch()} variant="outline">
            Coba lagi
          </Button>
        </div>
      );
    }
    if (sources.length === 0) {
      return (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <FileText aria-hidden="true" className="mx-auto size-6 text-slate-400" />
          <p className="mt-3 font-semibold">Belum ada Source</p>
        </div>
      );
    }
    return (
      <div className="mt-8 space-y-3">
        {sources.map((source) => {
          const index = selectedIndex.get(source.id) ?? -1;
          return (
            <SourceOption
              index={index}
              key={source.id}
              onMove={(direction) => moveSource(source.id, direction)}
              onPageRangeChange={(range) => updatePageRange(source.id, range)}
              onRetry={() => handleProcessingRetry(source.id)}
              onRoleChange={(role) => updateRole(source.id, role)}
              onToggle={() => toggleSource(source.id)}
              selection={selectedSources[index]}
              source={source}
              total={selectedSources.length}
              retryError={
                retrySource.isError && retrySource.variables?.sourceId === source.id
                  ? mutationErrorMessage(
                      retrySource.error,
                      true,
                      "Retry belum dapat dikirim. Coba lagi.",
                    )
                  : null
              }
              retrying={retrySource.isPending && retrySource.variables?.sourceId === source.id}
            />
          );
        })}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Modul baru
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Mulai dari materi yang ingin kamu pahami.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          Tambahkan teks, tautan publik, atau PDF, lalu atur Source utama dan prioritas Module.
        </p>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-teal-50 text-teal-700">
              <Plus aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Tambah materi</h2>
              <p className="text-sm text-slate-500">Pilih satu format Source untuk ditambahkan.</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5">
            {(
              [
                { kind: "text", label: "Teks", icon: FileText },
                { kind: "url", label: "URL", icon: Link },
                { kind: "pdf", label: "PDF", icon: Upload },
              ] as const
            ).map(({ kind, label, icon: Icon }) => (
              <button
                className={
                  sourceInputKind === kind
                    ? "flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 shadow-sm"
                    : "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-950"
                }
                key={kind}
                onClick={() => changeSourceInputKind(kind)}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </button>
            ))}
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSourceSubmit}>
            <div>
              <label className="text-sm font-semibold" htmlFor="source-title">
                Judul <span className="font-normal text-slate-500">(opsional)</span>
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600"
                disabled={activeSourceMutation.isPending}
                id="source-title"
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSourceRetry(null);
                  resetSourceMutations();
                }}
                placeholder="Contoh: Catatan sistem pencernaan"
                value={title}
              />
              {titleError ? <p className="mt-2 text-sm text-red-700">{titleError}</p> : null}
            </div>
            {sourceInputKind === "text" ? (
              <div>
                <label className="text-sm font-semibold" htmlFor="source-text">
                  Materi belajar
                </label>
                <textarea
                  className="mt-2 min-h-56 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 leading-7 outline-none focus:border-teal-600"
                  disabled={createTextSource.isPending}
                  id="source-text"
                  onChange={(event) => {
                    setText(event.target.value);
                    setSourceRetry(null);
                    createTextSource.reset();
                  }}
                  placeholder="Tempel catatan, artikel, atau materi belajar di sini…"
                  value={text}
                />
                {textError ? (
                  <p className="mt-2 text-sm text-red-700">{textError}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Maksimum 100.000 karakter Unicode.</p>
                )}
              </div>
            ) : null}
            {sourceInputKind === "url" ? (
              <div>
                <label className="text-sm font-semibold" htmlFor="source-url">
                  URL halaman publik
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600"
                  disabled={createUrlSource.isPending}
                  id="source-url"
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setSourceRetry(null);
                    createUrlSource.reset();
                  }}
                  placeholder="https://contoh.id/artikel"
                  type="url"
                  value={url}
                />
                {urlError ? (
                  <p className="mt-2 text-sm text-red-700">{urlError}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Hanya halaman HTTP/HTTPS publik tanpa login.
                  </p>
                )}
              </div>
            ) : null}
            {sourceInputKind === "pdf" ? (
              <div>
                <label className="text-sm font-semibold" htmlFor="source-pdf">
                  File PDF
                </label>
                <input
                  accept="application/pdf,.pdf"
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold"
                  disabled={createPdfSource.isPending}
                  id="source-pdf"
                  key={pdfInputVersion}
                  onChange={(event) => {
                    setPdf(event.target.files?.[0] ?? null);
                    setSourceRetry(null);
                    createPdfSource.reset();
                  }}
                  required
                  type="file"
                />
                <p className={pdfMessageClass}>{pdfMessage}</p>
              </div>
            ) : null}
            {sourceError && !titleError && !textError && !urlError && !pdfError ? (
              <p className="text-sm text-red-700" role="alert">
                {sourceError}
              </p>
            ) : null}
            <Button
              disabled={
                activeSourceMutation.isPending ||
                (sourceInputKind === "pdf" && (!pdf || pdf.size > MAX_PDF_SIZE_BYTES))
              }
              type="submit"
            >
              {sourceSubmitLabel}
            </Button>
          </form>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700">
              <BookOpenText aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Pilih dan urutkan Source</h2>
              <p className="text-sm text-slate-500">{selectedSources.length} Source dipilih.</p>
            </div>
          </div>
          {renderSourceOptions()}
          {sourcesQuery.hasNextPage ? (
            <Button
              className="mt-6"
              disabled={sourcesQuery.isFetchingNextPage}
              onClick={() => sourcesQuery.fetchNextPage()}
              variant="outline"
            >
              {sourcesQuery.isFetchingNextPage ? "Memuat…" : "Muat lagi"}
            </Button>
          ) : null}
        </section>

        <form
          className="mt-8 rounded-3xl border border-slate-200 bg-slate-100 p-6 sm:p-8"
          onSubmit={handleModuleSubmit}
        >
          <div className="flex items-center gap-3">
            <Sparkles aria-hidden="true" className="size-6 text-teal-700" />
            <h2 className="text-xl font-bold">Generate Module</h2>
          </div>
          <label className="mt-6 block text-sm font-semibold" htmlFor="generation-instruction">
            Generation Instruction <span className="font-normal text-slate-500">(opsional)</span>
          </label>
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 leading-7 outline-none focus:border-teal-600"
            disabled={createModule.isPending}
            id="generation-instruction"
            onChange={(event) => {
              setInstruction(event.target.value);
              invalidateModuleCommand();
            }}
            placeholder="Contoh: Fokus pada pemahaman konsep untuk tingkat SMA."
            value={instruction}
          />
          <p className="mt-2 text-sm text-slate-500">Maksimum 4.000 karakter Unicode.</p>
          {moduleValidationError ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {moduleValidationError}
            </p>
          ) : null}
          {moduleError ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {moduleError}
            </p>
          ) : null}
          {createModule.isError && moduleRetry ? (
            <p className="mt-3 text-sm text-amber-700">
              Coba lagi memakai key dan payload yang sama.
            </p>
          ) : null}
          <Button
            className="mt-6"
            disabled={createModule.isPending || selectedSources.length === 0}
            type="submit"
          >
            {moduleSubmitLabel}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
