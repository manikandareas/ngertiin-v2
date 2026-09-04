import { useAuth } from "@clerk/react";
import {
  type CreateModuleBodyInput,
  createModuleBodySchema,
  type CreateTextSourceBodyInput,
  type Source,
} from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { useCreateModule } from "../features/modules/api/use-modules";
import {
  sourcesQueryRootKey,
  useCreateTextSource,
  useSources,
} from "../features/sources/api/use-sources";
import { ApiProblemError } from "../lib/api";

type RetriableSourceCommand = { key: string; title: string; text: string };
type SelectedSource = { sourceId: string; role: "primary" | "reference" | "supplementary" };
type RetriableModuleCommand = { key: string; fingerprint: string; input: CreateModuleBodyInput };
type SourceOptionProps = {
  source: Source;
  selection: SelectedSource | undefined;
  index: number;
  total: number;
  onToggle: () => void;
  onRoleChange: (role: SelectedSource["role"]) => void;
  onMove: (direction: -1 | 1) => void;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fieldMessage(error: unknown, path: string): string | undefined {
  if (!(error instanceof ApiProblemError)) return undefined;
  return error.problem.errors?.find((fieldError) => fieldError.path === path)?.message;
}

function sourceTypeLabel(source: Source): string {
  if (source.type === "text") return "Teks";
  if (source.type === "pdf") return "PDF";
  return "URL";
}

function mutationErrorMessage(error: unknown, isError: boolean, fallback: string): string | null {
  if (error instanceof ApiProblemError) return error.problem.detail;
  return isError ? fallback : null;
}

function submitLabel(
  isPending: boolean,
  isError: boolean,
  pendingLabel: string,
  idleLabel: string,
): string {
  if (isPending) return pendingLabel;
  if (isError) return "Coba lagi";
  return idleLabel;
}

function SourceOption({
  source,
  selection,
  index,
  total,
  onToggle,
  onRoleChange,
  onMove,
}: SourceOptionProps) {
  const selectable = source.type === "text" && source.status === "ready";
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
            {sourceTypeLabel(source)} · {source.status} ·{" "}
            {dateFormatter.format(new Date(source.createdAt))}
          </span>
          {!selectable ? (
            <span className="mt-1 block text-xs text-amber-700">Belum tersedia untuk M2.</span>
          ) : null}
        </span>
      </label>
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
  const createSource = useCreateTextSource();
  const createModule = useCreateModule();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [sourceRetry, setSourceRetry] = useState<RetriableSourceCommand | null>(null);
  const [moduleRetry, setModuleRetry] = useState<RetriableModuleCommand | null>(null);
  const [moduleValidationError, setModuleValidationError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<SelectedSource[]>([]);
  const sources = sourcesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const selectedIndex = new Map(selectedSources.map((source, index) => [source.sourceId, index]));
  const titleError = fieldMessage(createSource.error, "title");
  const textError = fieldMessage(createSource.error, "text");
  const sourceError = mutationErrorMessage(
    createSource.error,
    createSource.isError,
    "Source belum dapat dibuat. Periksa koneksi lalu coba lagi.",
  );
  const moduleError = mutationErrorMessage(
    createModule.error,
    createModule.isError,
    "Module belum dapat dibuat. Periksa koneksi lalu coba lagi.",
  );
  const sourceSubmitLabel = submitLabel(
    createSource.isPending,
    createSource.isError,
    "Menyimpan…",
    "Simpan Source",
  );
  const moduleSubmitLabel = submitLabel(
    createModule.isPending,
    createModule.isError,
    "Mengirim…",
    "Generate Module",
  );

  function invalidateModuleCommand(): void {
    setModuleRetry(null);
    setModuleValidationError(null);
    if (createModule.isError || createModule.isSuccess) createModule.reset();
  }

  async function handleSourceSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const canRetry =
      sourceRetry !== null && sourceRetry.title === title && sourceRetry.text === text;
    const command = canRetry ? sourceRetry : { key: crypto.randomUUID(), title, text };
    setSourceRetry(command);
    const input: CreateTextSourceBodyInput = {
      ...(command.title.length > 0 ? { title: command.title } : {}),
      text: command.text,
    };
    try {
      const source = await createSource.mutateAsync({ input, key: command.key });
      setSelectedSources((current) =>
        current.some((selected) => selected.sourceId === source.id)
          ? current
          : [
              ...current,
              { sourceId: source.id, role: current.length === 0 ? "primary" : "reference" },
            ],
      );
      setTitle("");
      setText("");
      setSourceRetry(null);
      invalidateModuleCommand();
      await queryClient.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
    } catch {
      // Mutation state renders the safe error and preserves the command key.
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
              onRoleChange={(role) => updateRole(source.id, role)}
              onToggle={() => toggleSource(source.id)}
              selection={selectedSources[index]}
              source={source}
              total={selectedSources.length}
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
          Tempel materi sekali, lalu atur Source utama dan urutan prioritas untuk Module.
        </p>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-teal-50 text-teal-700">
              <Plus aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Tambah materi teks</h2>
              <p className="text-sm text-slate-500">Isi materi tidak akan ditampilkan kembali.</p>
            </div>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSourceSubmit}>
            <div>
              <label className="text-sm font-semibold" htmlFor="source-title">
                Judul <span className="font-normal text-slate-500">(opsional)</span>
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600"
                disabled={createSource.isPending}
                id="source-title"
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSourceRetry(null);
                  createSource.reset();
                }}
                placeholder="Contoh: Catatan sistem pencernaan"
                value={title}
              />
              {titleError ? <p className="mt-2 text-sm text-red-700">{titleError}</p> : null}
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="source-text">
                Materi belajar
              </label>
              <textarea
                className="mt-2 min-h-56 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 leading-7 outline-none focus:border-teal-600"
                disabled={createSource.isPending}
                id="source-text"
                onChange={(event) => {
                  setText(event.target.value);
                  setSourceRetry(null);
                  createSource.reset();
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
            {sourceError && !titleError && !textError ? (
              <p className="text-sm text-red-700" role="alert">
                {sourceError}
              </p>
            ) : null}
            <Button disabled={createSource.isPending} type="submit">
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
