import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { ApiProblemError } from "../../lib/api";
import {
  generationQueryKey,
  moduleQueryKey,
  useGeneration,
  useGenerationStream,
  useModule,
  useRetryGeneration,
} from "../modules/api/use-modules";
import { BuilderLayout } from "./builder-layout";
import { BuilderResult } from "./builder-result";
import { GenerationTrack } from "./generation-track";

export function BuilderGeneration({ moduleId }: { moduleId: string }) {
  const { userId } = useAuth();
  const client = useQueryClient();
  const moduleQuery = useModule(moduleId);
  const module = moduleQuery.data;
  const enabled = module?.status === "generating" || module?.status === "failed";
  const [restart, setRestart] = useState(0);
  const polling = useGenerationStream(moduleId, restart, enabled);
  const generationQuery = useGeneration(moduleId, polling, enabled);
  const retry = useRetryGeneration(moduleId);
  const retryKey = useRef<string | null>(null);
  const retryLock = useRef(false);
  const generation = generationQuery.data;
  const ready = module?.status === "ready" || module?.status === "archived";
  async function retryGeneration() {
    if (retryLock.current) return;
    retryLock.current = true;
    retryKey.current ??= crypto.randomUUID();
    try {
      const result = await retry.mutateAsync(retryKey.current);
      client.setQueryData(moduleQueryKey(userId, moduleId), result.module);
      client.setQueryData(generationQueryKey(userId, moduleId), result.generation);
      retryKey.current = null;
      setRestart((value) => value + 1);
    } catch {
      // Keep the command key for a safe retry after an ambiguous network failure.
    } finally {
      retryLock.current = false;
    }
  }
  return (
    <BuilderLayout step={ready ? 4 : 3}>
      {moduleQuery.isError ? (
        <div role="alert" className="space-y-4">
          <p>Modul belum dapat dimuat. Periksa koneksi atau aksesmu.</p>
          <Button variant="outline" onClick={() => void moduleQuery.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : ready && module ? (
        <BuilderResult module={module} />
      ) : !module || (!generation && !generationQuery.isError) ? (
        <div role="status" className="space-y-6 py-6">
          <p className="text-sm text-muted-foreground">Memuat progres pembuatan…</p>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-16 w-3/4 rounded-2xl bg-muted motion-safe:animate-pulse ${i % 2 ? "ml-auto" : ""}`}
            />
          ))}
        </div>
      ) : (
        <>
          {generation ? <GenerationTrack generation={generation} /> : null}
          {generationQuery.isError ? (
            <div role="alert" className="mt-4 space-y-3">
              <p className="text-sm text-destructive">Pembaruan progres belum dapat dimuat.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setRestart((value) => value + 1);
                  void generationQuery.refetch();
                }}
              >
                Hubungkan kembali
              </Button>
            </div>
          ) : null}
          {generation?.state === "failed" ? (
            <div
              role="alert"
              className="mt-5 space-y-4 rounded-xl border border-destructive/30 p-4"
            >
              <p className="text-sm text-destructive">
                {generation.failure?.message ?? "Pembuatan modul belum berhasil."}
              </p>
              {generation.failure?.retryable ? (
                <Button disabled={retry.isPending} onClick={() => void retryGeneration()}>
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
          ) : (
            <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
              Kamu boleh kembali ke Beranda. Proses tetap berjalan dan dapat dibuka lagi dari daftar
              modul.
            </p>
          )}
        </>
      )}
    </BuilderLayout>
  );
}
