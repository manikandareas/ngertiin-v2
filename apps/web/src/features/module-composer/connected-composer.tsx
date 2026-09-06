import { useAuth } from "@clerk/react";
import type { Source } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { useCreateModule } from "../modules/api/use-modules";
import {
  sourceQueryKey,
  sourcesQueryRootKey,
  useCreatePdfSource,
  useCreateTextSource,
  useCreateUrlSource,
  useRetrySource,
  useSource,
  useSources,
} from "../sources/api/use-sources";
import { Composer } from "./composer";
import { statusLabels } from "./composer-presentation";
import { type ComposerState, useComposer } from "./use-composer";

export function ConnectedComposer() {
  const { userId } = useAuth();
  return <UserComposer key={userId} />;
}
function UserComposer() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const text = useCreateTextSource();
  const url = useCreateUrlSource();
  const pdf = useCreatePdfSource();
  const module = useCreateModule();
  const state = useComposer({
    save: async (command) => {
      const fields = command.title.trim() ? { title: command.title } : {};
      const source =
        command.kind === "text"
          ? await text.mutateAsync({ input: { ...fields, text: command.value }, key: command.key })
          : command.kind === "url"
            ? await url.mutateAsync({ input: { ...fields, url: command.value }, key: command.key })
            : await pdf.mutateAsync({ fields, file: command.file as File, key: command.key });
      client.setQueryData(sourceQueryKey(userId, source.id), source);
      void client.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
      return source;
    },
    create: async (input, key) => {
      const result = await module.mutateAsync({ input, key });
      if (active.current) navigate(`/modules/${result.module.id}`);
    },
  });
  return (
    <Composer
      state={state}
      library={state.panel === "library" ? <SourceLibrary state={state} /> : null}
      statuses={state.selected.map((item) => (
        <SelectedStatus key={item.source.id} source={item.source} setStatuses={state.setStatuses} />
      ))}
    />
  );
}
function SelectedStatus({
  source,
  setStatuses,
}: {
  source: Source;
  setStatuses: ComposerState["setStatuses"];
}) {
  const query = useSource(source.id);
  useEffect(() => {
    setStatuses((current) => ({
      ...current,
      [source.id]: { source: query.data, error: query.isError },
    }));
  }, [query.data, query.isError, source.id, setStatuses]);
  if (query.isError)
    return (
      <div className="text-sm text-destructive" role="alert">
        Status {source.title ?? "materi"} belum dapat dibaca.{" "}
        <Button type="button" size="sm" variant="link" onClick={() => void query.refetch()}>
          Periksa lagi
        </Button>
      </div>
    );
  return query.data?.status === "failed" ? <SourceRetry source={query.data} /> : null;
}
function SourceRetry({ source }: { source: Source }) {
  const { userId } = useAuth();
  const client = useQueryClient();
  const retry = useRetrySource();
  const key = useRef<string | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState(false);
  return (
    <div className="space-y-2 text-sm text-destructive">
      <p>
        {source.title ?? "Materi"}: {source.failure?.message ?? "Pemrosesan gagal."}
      </p>
      {source.failure?.retryable ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retry.isPending}
          onClick={async () => {
            if (lock.current) return;
            lock.current = true;
            key.current ??= crypto.randomUUID();
            setError(false);
            try {
              const value = await retry.mutateAsync({ sourceId: source.id, key: key.current });
              client.setQueryData(sourceQueryKey(userId, source.id), value);
              key.current = null;
              void client.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
            } catch {
              setError(true);
            } finally {
              lock.current = false;
            }
          }}
        >
          Coba proses lagi
        </Button>
      ) : null}
      {error ? <p role="alert">Belum dapat diproses ulang. Coba lagi.</p> : null}
    </div>
  );
}
function SourceLibrary({ state }: { state: ComposerState }) {
  const query = useSources({ limit: 20 });
  const sources = query.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <div className="space-y-3">
      {query.isPending ? <p role="status">Memuat materi…</p> : null}
      {query.isError ? (
        <div role="alert">
          Materi belum dapat dimuat.{" "}
          <Button type="button" size="sm" variant="link" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      {!query.isPending && !query.isError && !sources.length ? (
        <p className="text-sm text-muted-foreground">Belum ada materi tersimpan.</p>
      ) : null}
      {sources.map((source) => (
        <div key={source.id} className="border-t pt-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={state.selected.some((item) => item.source.id === source.id)}
              onChange={() => state.toggle(source)}
            />
            <span className="min-w-0 break-words">
              {source.title ?? "Materi tanpa judul"}
              <span className="block text-caption text-muted-foreground">
                {source.type.toUpperCase()} · {statusLabels[source.status]}
              </span>
            </span>
          </label>
          {source.status === "failed" &&
          !state.selected.some((item) => item.source.id === source.id) ? (
            <SourceRetry source={source} />
          ) : null}
        </div>
      ))}
      {query.hasNextPage ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Muat lagi
        </Button>
      ) : null}
    </div>
  );
}
