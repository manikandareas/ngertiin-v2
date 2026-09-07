import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useGeneration, useGenerationStream, useModule } from "../modules/api/use-modules";
import { BuilderLayout } from "./builder-layout";
import { BuilderResult } from "./builder-result";
import { GenerationFailure } from "./generation-failure";
import { GenerationTrack } from "./generation-track";

export function BuilderGeneration({ moduleId }: { moduleId: string }) {
  const moduleQuery = useModule(moduleId);
  const module = moduleQuery.data;
  const enabled = module?.status === "generating" || module?.status === "failed";
  const [restart, setRestart] = useState(0);
  const polling = useGenerationStream(moduleId, restart, enabled);
  const generationQuery = useGeneration(moduleId, polling, enabled);
  const generation = generationQuery.data;
  const ready = module?.status === "ready" || module?.status === "archived";
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
            <GenerationFailure
              moduleId={moduleId}
              generation={generation}
              onRestart={() => setRestart((value) => value + 1)}
            />
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
