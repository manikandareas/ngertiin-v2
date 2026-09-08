import { useAuth } from "@clerk/react";
import type { Source } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { ApiProblemError } from "../../lib/api";
import { sourceQueryKey, sourcesQueryRootKey, useRetrySource } from "./api/use-sources";

export function SourceRetry({ source }: { source: Source }) {
  const { userId } = useAuth();
  const client = useQueryClient();
  const retry = useRetrySource();
  const key = useRef<string | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 text-sm text-destructive">
      <p>
        {source.title ?? "Materi"}: {source.failure?.message ?? "Pemrosesan gagal."}
      </p>
      {source.retriesRemaining === 0 && source.failure?.retryable ? (
        <p className="text-xs text-muted-foreground">
          Batas 2 kali percobaan ulang sudah tercapai.
        </p>
      ) : null}
      {!source.archivedAt && source.failure?.retryable && source.retriesRemaining > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retry.isPending}
          onClick={async () => {
            if (lock.current) return;
            lock.current = true;
            key.current ??= crypto.randomUUID();
            setError(null);
            try {
              const value = await retry.mutateAsync({ sourceId: source.id, key: key.current });
              client.setQueryData(sourceQueryKey(userId, source.id), value);
              key.current = null;
              void client.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
            } catch (error) {
              setError(
                error instanceof ApiProblemError
                  ? error.problem.detail
                  : "Belum dapat diproses ulang. Coba lagi.",
              );
              void client.invalidateQueries({ queryKey: sourceQueryKey(userId, source.id) });
            } finally {
              lock.current = false;
            }
          }}
        >
          Coba proses lagi
        </Button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
