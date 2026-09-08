import { ArrowRight01Icon, ArrowRightDoubleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { useModules } from "../../modules/api/use-modules";
import { ModuleCard } from "../../modules/components/module-card";

export function DashboardModules() {
  const modules = useModules();
  const recent = modules.data?.pages[0]?.data.slice(0, 2) ?? [];

  return (
    <section aria-labelledby="modules-heading" className="min-w-0">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h2 id="modules-heading" className="font-display text-subheading font-extrabold">
          Terakhir diperbarui
        </h2>
        <Button asChild variant="link" size="sm" className="h-auto px-0 py-1">
          <Link to="/modules">
            Semua modul
            <HugeiconsIcon
              icon={ArrowRightDoubleIcon}
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </Link>
        </Button>
      </header>
      {modules.isPending ? (
        <p role="status" className="py-9 text-center text-sm text-muted-foreground">
          Memuat modul…
        </p>
      ) : modules.isError && recent.length === 0 ? (
        <div className="rounded-card border-2 bg-card px-6 py-9 text-center">
          <p role="alert" className="font-semibold">
            Modul belum dapat dimuat.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => modules.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : recent.length ? (
        <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
          {recent.map((module) => (
            <li key={module.id} className="grid min-w-0">
              <ModuleCard module={module} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-card border-2 border-dashed bg-card/60 px-6 py-9 text-center">
          <h3 className="font-display text-subheading font-bold">
            Modul pertamamu dimulai dari rasa penasaran.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Mulai dengan satu materi yang ingin kamu pahami.
          </p>
          <Button asChild variant="link" size="sm" className="mt-3">
            <Link to="/modules/new">
              Buat modul pertama
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
