import { useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { useArchiveModule, useJourney, useModule } from "../features/modules/api/use-modules";
import { JourneySummary } from "../features/modules/components/journey-summary";
import { JourneyTrack } from "../features/modules/components/journey-track";
import { ApiProblemError } from "../lib/api";

export default function ModuleJourneyPage() {
  const { moduleId } = useParams();
  const journey = useJourney(moduleId);
  const moduleQuery = useModule(moduleId);
  const archive = useArchiveModule(moduleId ?? "");

  if (journey.isPending || moduleQuery.isPending) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Memuat Journey…</p>
      </AppShell>
    );
  }
  if (journey.isError || moduleQuery.isError || !journey.data || !moduleQuery.data) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-3xl border border-destructive/30 bg-card p-8">
          <h1 className="text-2xl font-bold">Journey belum dapat dimuat</h1>
          <p className="mt-3 text-muted-foreground">
            Periksa akses Module atau coba muat ulang halaman.
          </p>
        </div>
      </AppShell>
    );
  }

  const archiveError =
    archive.error instanceof ApiProblemError
      ? archive.error.problem.detail
      : archive.isError
        ? "Module belum dapat diarsipkan."
        : null;

  async function handleArchive(): Promise<void> {
    if (!window.confirm("Arsipkan Module ini? Progress dan riwayat tetap dapat dibaca.")) return;
    try {
      await archive.mutateAsync();
    } catch {
      // Mutation state renders the safe error.
    }
  }

  return (
    <AppShell>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
        <JourneySummary
          data={journey.data}
          status={moduleQuery.data.status}
          archiving={archive.isPending}
          archiveError={archiveError}
          onArchive={handleArchive}
        />
        <JourneyTrack data={journey.data} canLearn={moduleQuery.data.status === "ready"} />
      </div>
    </AppShell>
  );
}
