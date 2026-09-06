import type { Dashboard, ModuleSummary, Source } from "@ngertiin/contracts/api";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { AppSidebar } from "./components/app-sidebar";
import { DashboardContent } from "./features/dashboard/components/dashboard-content";
import { Composer } from "./features/module-composer/composer";
import { type ComposerState, useComposer } from "./features/module-composer/use-composer";
import "./index.css";

const modules = [
  ["Mengenal sistem tata surya", "Jelajahi planet, bintang, dan tempat kita di alam semesta.", 40],
  ["Dasar berpikir kritis", "Belajar bertanya, memahami argumen, dan mengambil keputusan.", 0],
  ["Dunia kecil di dalam sel", "Kenali struktur sel dan bagaimana kehidupan bekerja.", 75],
  ["Memahami perubahan iklim", "Pahami hubungan antara bumi, energi, dan aktivitas manusia.", 100],
] satisfies [string, string, number][];

const previewModules: ModuleSummary[] = modules.map(([title, description, percentage], index) => ({
  id: `preview-${index}`,
  title: title,
  description: description,
  status: "ready",
  difficulty: "beginner",
  estimatedMinutes: 20,
  progress: {
    status: percentage === 100 ? "completed" : percentage > 0 ? "in_progress" : "not_started",
    percentage: percentage,
    completedCoreNodes: percentage / 5,
    totalCoreNodes: 20,
  },
  nextAction: { type: "none" },
  createdAt: "2026-09-05T00:00:00Z",
  updatedAt: "2026-09-05T00:00:00Z",
}));
const empty = new URLSearchParams(location.search).has("empty");
const data: Dashboard = {
  modules: empty ? [] : previewModules,
  continueLearning: empty || !previewModules[0] ? null : { module: previewModules[0] },
  stats: {
    totalXp: empty ? 0 : 710,
    currentStreak: empty ? 0 : 4,
    longestStreak: empty ? 0 : 11,
    lastLearningDate: empty ? null : "2026-09-05",
  },
};
function PreviewComposer() {
  const [message, setMessage] = useState("");
  const state = useComposer({
    save: async (command) => ({
      id: crypto.randomUUID(),
      type: command.kind,
      title: command.title || command.file?.name || "Materi baru",
      status: "ready",
      ...(command.kind === "pdf" ? { pageCount: 12 } : {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    create: async () => {
      setMessage("Modul siap dibuat — preview lokal, tanpa request API.");
    },
  });
  return (
    <>
      <Composer
        state={state}
        statuses={state.selected.map((item) => (
          <PreviewStatus
            key={item.source.id}
            source={item.source}
            setStatuses={state.setStatuses}
          />
        ))}
        library={
          <p className="text-sm text-muted-foreground">
            Belum ada materi tersimpan di preview ini.
          </p>
        }
      />
      {message ? <p role="status">{message}</p> : null}
    </>
  );
}
function PreviewStatus({
  source,
  setStatuses,
}: {
  source: Source;
  setStatuses: ComposerState["setStatuses"];
}) {
  useEffect(() => {
    setStatuses((current) => ({ ...current, [source.id]: { source, error: false } }));
  }, [source, setStatuses]);
  return null;
}
function PreviewDashboard() {
  const { hash } = useLocation();
  return (
    <DashboardContent
      data={data}
      name="Vito"
      composer={<PreviewComposer />}
      composerVisible={hash === "#module-composer"}
    />
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AppShell sidebar={<AppSidebar name="Vito" modules={data.modules} />} workspace>
        <p className="sr-only">Preview desain · data contoh</p>
        <PreviewDashboard />
      </AppShell>
    </MemoryRouter>,
  );
