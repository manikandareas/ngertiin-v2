import { type JSX, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { ApiProblemError } from "../../../lib/api";
import { useRetryAdaptiveGeneration } from "../api/use-modules";

interface AdaptiveGenerationRetryProps {
  interventionId: string;
}

export function AdaptiveGenerationRetry({
  interventionId,
}: AdaptiveGenerationRetryProps): JSX.Element {
  const mutation = useRetryAdaptiveGeneration(interventionId);
  const commandKey = useRef<string | null>(null);
  const pending = useRef(false);
  async function retry(): Promise<void> {
    if (pending.current) return;
    pending.current = true;
    commandKey.current ??= crypto.randomUUID();
    try {
      await mutation.mutateAsync(commandKey.current);
      commandKey.current = null;
    } catch {
      // Preserve the key after an ambiguous response so a repeat click cannot start another run.
    } finally {
      pending.current = false;
    }
  }
  return (
    <div className="mt-4 space-y-3">
      <Button disabled={mutation.isPending} onClick={() => void retry()}>
        {mutation.isPending ? "Menyiapkan ulang…" : "Coba buat ulang"}
      </Button>
      {mutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error instanceof ApiProblemError
            ? mutation.error.problem.detail
            : "Belum dapat mencoba ulang. Periksa koneksimu lalu coba lagi."}
        </p>
      ) : null}
    </div>
  );
}
