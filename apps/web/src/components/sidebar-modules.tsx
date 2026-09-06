import type { ModuleSummary } from "@ngertiin/contracts/api";
import { NavLink } from "react-router-dom";
import { moduleOverviewRoute } from "../features/modules/next-learning-route";

type SidebarModulesProps = {
  modules?: ModuleSummary[];
  pending: boolean;
  error: boolean;
  retry?: () => void;
};
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
export function SidebarModules({ modules, pending, error, retry }: SidebarModulesProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const recent = [...(modules ?? [])]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 8);
  const groups = [
    { label: "Hari ini", items: recent.filter((m) => Date.parse(m.updatedAt) >= +today) },
    {
      label: "Kemarin",
      items: recent.filter(
        (m) => Date.parse(m.updatedAt) >= +yesterday && Date.parse(m.updatedAt) < +today,
      ),
    },
    { label: "Sebelumnya", items: recent.filter((m) => Date.parse(m.updatedAt) < +yesterday) },
  ];
  return (
    <section aria-label="Modul terbaru" className="border-t pt-4 pb-3">
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground motion-safe:animate-pulse">
          Memuat modul…
        </p>
      ) : error ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Modul belum dapat dimuat.</p>
          <button type="button" onClick={retry} className={`rounded-sm text-link ${focus}`}>
            Coba lagi
          </button>
        </div>
      ) : recent.length ? (
        groups.map((group) =>
          group.items.length ? (
            <div key={group.label} className="mb-4 last:mb-0">
              <h2 className="mb-1.5 text-caption font-medium text-muted-foreground">
                {group.label}
              </h2>
              <ul>
                {group.items.map((module) => (
                  <li key={module.id}>
                    <NavLink
                      to={moduleOverviewRoute(module)}
                      title={module.title ?? "Modul baru"}
                      className={({ isActive }) =>
                        `-mx-2 block truncate rounded-sm px-2 py-2 text-sm ${focus} ${isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`
                      }
                    >
                      {module.title ?? "Modul baru"}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )
      ) : (
        <>
          <h2 className="mb-3 text-sm text-muted-foreground">Modul terbaru</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Modul yang kamu buat akan muncul di sini.
          </p>
        </>
      )}
    </section>
  );
}
