import { useAuth } from "@clerk/react";
import type { Source } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  sourceQueryKey,
  sourcesQueryRootKey,
  useRetrySource,
  useSource,
} from "../sources/api/use-sources";
import type { ModuleBuilderState } from "./use-module-builder";

export function SelectedStatus({
  source,
  setStatuses,
}: {
  source: Source;
  setStatuses: ModuleBuilderState["setStatuses"];
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
