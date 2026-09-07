import type { Dashboard, ModuleSummary } from "@ngertiin/contracts/api";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { AppSidebar } from "./components/app-sidebar";
import { DashboardContent } from "./features/dashboard/components/dashboard-content";
import "./index.css";

const modules = [
  ["Mengenal sistem tata surya", "Jelajahi planet, bintang, dan tempat kita di alam semesta.", 40],
  ["Dasar berpikir kritis", "Belajar bertanya, memahami argumen, dan mengambil keputusan.", 0],
  ["Dunia kecil di dalam sel", "Kenali struktur sel dan bagaimana kehidupan bekerja.", 75],
  ["Memahami perubahan iklim", "Pahami hubungan antara bumi, energi, dan aktivitas manusia.", 100],
] satisfies [string, string, number][];

const previewModules: ModuleSummary[] = modules.map(([title, description, percentage], index) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
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
  nextAction:
    percentage === 100
      ? {
          type: "module_completed",
          moduleId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        }
      : {
          type: percentage > 0 ? "resume_core_node" : "start_core_node",
          moduleId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          nodeId: `00000000-0000-4000-9000-${String(index).padStart(12, "0")}`,
        },
  createdAt: "2026-09-05T00:00:00Z",
  updatedAt: "2026-09-05T00:00:00Z",
}));
const params = new URLSearchParams(location.search);
const empty = params.has("empty");
if (params.has("mixed")) {
  previewModules.push(
    ...(["generating", "failed", "archived"] as const).map(
      (status, index): ModuleSummary => ({
        id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
        title:
          status === "generating"
            ? null
            : `Modul ${status}: ${"Materi dengan judul panjang ".repeat(5)}`,
        description: null,
        status,
        difficulty: null,
        estimatedMinutes: null,
        progress: null,
        nextAction:
          status === "archived"
            ? { type: "none" }
            : {
                type: status === "failed" ? "retry_module" : "wait_for_module",
                moduleId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
              },
        createdAt: "2026-09-05T00:00:00Z",
        updatedAt: "2026-09-06T00:00:00Z",
      }),
    ),
  );
}
const data: Dashboard = {
  modules: empty ? [] : previewModules,
  continueLearning:
    empty || params.has("no-resume") || !previewModules[0] ? null : { module: previewModules[0] },
  stats: {
    totalXp: empty ? 0 : 710,
    currentStreak: empty ? 0 : 4,
    longestStreak: empty ? 0 : 11,
    lastLearningDate: empty ? null : "2026-09-05",
  },
};
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AppShell sidebar={<AppSidebar name="Vito" />} workspace>
        <p className="sr-only">Preview desain · data contoh</p>
        <DashboardContent data={data} name="Vito" />
      </AppShell>
    </MemoryRouter>,
  );
