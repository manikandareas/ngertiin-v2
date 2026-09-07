import { useAuth } from "@clerk/react";
import type { GenerationStatus } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { ApiProblemError } from "../../lib/api";
import { generationQueryKey, moduleQueryKey, useRetryGeneration } from "../modules/api/use-modules";
import { UsageNotice } from "../usage/usage-notice";
import { useUsage } from "../usage/use-usage";

export function GenerationFailure({
  moduleId,
  generation,
  onRestart,
}: {
  moduleId: string;
  generation: GenerationStatus;
  onRestart: () => void;
}) {
  const { userId } = useAuth();
  const client = useQueryClient();
  const usage = useUsage();
  const retry = useRetryGeneration(moduleId);
  const retryKey = useRef<string | null>(null);
  const retryLock = useRef(false);
  async function retryGeneration() {
    if (retryLock.current) return;
    retryLock.current = true;
    retryKey.current ??= crypto.randomUUID();
    try {
      const result = await retry.mutateAsync(retryKey.current);
      client.setQueryData(moduleQueryKey(userId, moduleId), result.module);
      client.setQueryData(generationQueryKey(userId, moduleId), result.generation);
      retryKey.current = null;
      onRestart();
    } catch {
      // Keep the command key for a safe retry after an ambiguous network failure.
    } finally {
      retryLock.current = false;
    }
  }
  return (
    <div role="alert" className="mt-5 space-y-4 rounded-xl border border-destructive/30 p-4">
      <p className="text-sm text-destructive">
        {generation.failure?.message ?? "Pembuatan modul belum berhasil."}
      </p>
      {generation.retriesRemaining === 0 && generation.failure?.retryable ? (
        <p className="text-sm text-muted-foreground">
          Batas 2 kali percobaan ulang sudah tercapai.
        </p>
      ) : null}
      <UsageNotice category="modules" showQuota={false} />
      {generation.failure?.retryable && generation.retriesRemaining > 0 ? (
        <Button
          disabled={retry.isPending || !usage.data || !!usage.data.activeModuleId}
          onClick={() => void retryGeneration()}
        >
          {retry.isPending ? "Menyiapkan ulang…" : "Coba buat lagi"}
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link to="/modules/new">Buat modul baru</Link>
        </Button>
      )}
      {retry.isError ? (
        <p className="text-sm text-destructive">
          {retry.error instanceof ApiProblemError
            ? retry.error.problem.detail
            : "Belum dapat dicoba ulang. Periksa koneksi, lalu coba lagi."}
        </p>
      ) : null}
    </div>
  );
}
