import { Archive } from "lucide-react";
import { useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { ChatSidebar } from "../features/chat/components/chat-sidebar";
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
    <AppShell
      rightSidebar={
        moduleId ? (
          <ChatSidebar moduleId={moduleId} pageContext={{ surface: "journey" }} />
        ) : undefined
      }
    >
      <div className="mx-auto flex max-w-2xl flex-col">
        <JourneySummary data={journey.data} status={moduleQuery.data.status} />
        <JourneyTrack data={journey.data} canLearn={moduleQuery.data.status === "ready"} />
        {moduleQuery.data.status === "ready" ? (
          <footer className="mt-8 border-t pt-4">
            <Button
              disabled={archive.isPending}
              onClick={handleArchive}
              variant="ghost"
              size="sm"
              className="h-11 px-2 text-xs normal-case text-muted-foreground"
            >
              <Archive aria-hidden="true" />
              {archive.isPending ? "Mengarsipkan…" : "Arsipkan modul"}
            </Button>
            {archiveError ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {archiveError}
              </p>
            ) : null}
          </footer>
        ) : null}
      </div>
    </AppShell>
  );
}
