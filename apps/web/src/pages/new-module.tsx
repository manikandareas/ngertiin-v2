import { useAuth } from "@clerk/react";
import type { CreateTextSourceBodyInput, Source } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenText, Check, FileText, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import {
  sourcesQueryRootKey,
  useCreateTextSource,
  useSources,
} from "../features/sources/api/use-sources";
import { ApiProblemError } from "../lib/api";

type RetriableCommand = {
  key: string;
  title: string;
  text: string;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fieldMessage(error: unknown, path: string): string | undefined {
  if (!(error instanceof ApiProblemError)) {
    return undefined;
  }
  return error.problem.errors?.find((fieldError) => fieldError.path === path)?.message;
}

function sourceTypeLabel(source: Source): string {
  if (source.type === "text") {
    return "Teks";
  }
  if (source.type === "pdf") {
    return "PDF";
  }
  return "URL";
}

function SourceOption({
  source,
  selected,
  onToggle,
}: {
  source: Source;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-300">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-slate-300 bg-white text-white has-[:checked]:border-teal-600 has-[:checked]:bg-teal-600">
        <input checked={selected} className="sr-only" onChange={onToggle} type="checkbox" />
        {selected ? <Check aria-hidden="true" className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{source.title ?? "Materi tanpa judul"}</span>
        <span className="mt-1 block text-sm text-slate-500">
          {sourceTypeLabel(source)} · {source.status} ·{" "}
          {dateFormatter.format(new Date(source.createdAt))}
        </span>
      </span>
    </label>
  );
}

export default function NewModulePage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const sourcesQuery = useSources({ limit: 20 });
  const createSource = useCreateTextSource();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [retryCommand, setRetryCommand] = useState<RetriableCommand | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(() => new Set());
  const sources = sourcesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const titleError = fieldMessage(createSource.error, "title");
  const textError = fieldMessage(createSource.error, "text");
  const generalError =
    createSource.error instanceof ApiProblemError
      ? createSource.error.problem.detail
      : createSource.isError
        ? "Source belum dapat dibuat. Periksa koneksi lalu coba lagi."
        : undefined;

  function handleInputChange(update: () => void): void {
    update();
    if (createSource.isError) {
      setRetryCommand(null);
      createSource.reset();
    } else if (createSource.isSuccess) {
      createSource.reset();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const canRetry =
      retryCommand !== null && retryCommand.title === title && retryCommand.text === text;
    const command = canRetry
      ? retryCommand
      : {
          key: crypto.randomUUID(),
          title,
          text,
        };
    setRetryCommand(command);

    const input: CreateTextSourceBodyInput = {
      ...(command.title.length > 0 ? { title: command.title } : {}),
      text: command.text,
    };

    try {
      const source = await createSource.mutateAsync({ input, key: command.key });
      setSelectedSourceIds((current) => new Set(current).add(source.id));
      setTitle("");
      setText("");
      setRetryCommand(null);
      await queryClient.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
    } catch {
      // The mutation state renders the safe API or network error and keeps this command for retry.
    }
  }

  function toggleSource(sourceId: string): void {
    setSelectedSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
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
          Tempel materi sekali, lalu pilih kembali Source yang sama untuk modul berikutnya.
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

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-semibold" htmlFor="source-title">
                Judul <span className="font-normal text-slate-500">(opsional)</span>
              </label>
              <input
                aria-describedby={titleError ? "source-title-error" : undefined}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600"
                disabled={createSource.isPending}
                id="source-title"
                onChange={(event) => handleInputChange(() => setTitle(event.target.value))}
                placeholder="Contoh: Catatan sistem pencernaan"
                type="text"
                value={title}
              />
              {titleError ? (
                <p className="mt-2 text-sm text-red-700" id="source-title-error">
                  {titleError}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="source-text">
                Materi belajar
              </label>
              <textarea
                aria-describedby={textError ? "source-text-error" : "source-text-help"}
                className="mt-2 min-h-56 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 leading-7 outline-none focus:border-teal-600"
                disabled={createSource.isPending}
                id="source-text"
                onChange={(event) => handleInputChange(() => setText(event.target.value))}
                placeholder="Tempel catatan, artikel, atau materi belajar di sini…"
                value={text}
              />
              {textError ? (
                <p className="mt-2 text-sm text-red-700" id="source-text-error">
                  {textError}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500" id="source-text-help">
                  Maksimum 100.000 karakter Unicode.
                </p>
              )}
            </div>

            {generalError && !titleError && !textError ? (
              <p className="text-sm text-red-700" role="alert">
                {generalError}
              </p>
            ) : null}
            {createSource.isError && retryCommand ? (
              <p className="text-sm text-amber-700" role="status">
                Coba lagi akan memakai perintah yang sama dengan aman. Mengedit input akan membuat
                perintah baru.
              </p>
            ) : null}
            {createSource.isSuccess ? (
              <p className="text-sm text-teal-700" role="status">
                Source tersimpan dan langsung dipilih.
              </p>
            ) : null}

            <Button disabled={createSource.isPending} type="submit">
              {createSource.isPending
                ? "Menyimpan…"
                : createSource.isError && retryCommand
                  ? "Coba lagi"
                  : "Simpan Source"}
            </Button>
          </form>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700">
              <BookOpenText aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Source library</h2>
              <p className="text-sm text-slate-500">
                {selectedSourceIds.size} Source dipilih untuk modul ini.
              </p>
            </div>
          </div>

          {sourcesQuery.isPending ? (
            <p className="mt-8 text-sm text-slate-500">Memuat Source…</p>
          ) : sourcesQuery.isError && sources.length === 0 ? (
            <div className="mt-8">
              <p className="text-sm text-red-700">Source library belum dapat dimuat.</p>
              <Button className="mt-4" onClick={() => sourcesQuery.refetch()} variant="outline">
                Coba lagi
              </Button>
            </div>
          ) : sources.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <FileText aria-hidden="true" className="mx-auto size-6 text-slate-400" />
              <p className="mt-3 font-semibold">Belum ada Source</p>
              <p className="mt-1 text-sm text-slate-500">
                Materi yang kamu simpan akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {sources.map((source) => (
                <SourceOption
                  key={source.id}
                  onToggle={() => toggleSource(source.id)}
                  selected={selectedSourceIds.has(source.id)}
                  source={source}
                />
              ))}
            </div>
          )}

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
          {sourcesQuery.isFetchNextPageError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              Halaman berikutnya belum dapat dimuat. Coba tombol “Muat lagi” sekali lagi.
            </p>
          ) : null}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-100 p-6 sm:p-8">
          <h2 className="text-xl font-bold">Generate Module</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Generasi Module akan tersedia pada M2. Source pilihanmu tetap tersimpan di halaman ini.
          </p>
          <Button className="mt-5" disabled type="button">
            Generate Module
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
