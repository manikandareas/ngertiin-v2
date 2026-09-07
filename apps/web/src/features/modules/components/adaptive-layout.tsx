import { ArrowLeft01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { JSX, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";

const steps = ["Tinjau penguatan", "Siapkan materi", "Mulai belajar"];

interface AdaptiveLayoutProps {
  children: ReactNode;
  moduleId?: string;
  step: number | null;
}

export function AdaptiveLayout({ children, moduleId, step }: AdaptiveLayoutProps): JSX.Element {
  return (
    <main className="min-h-dvh bg-background text-foreground [&_[data-slot=button]]:font-semibold [&_[data-slot=button]]:tracking-normal [&_[data-slot=button]]:normal-case">
      <header className="flex h-12 items-center border-b border-muted px-4 sm:px-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
        >
          <Link to={moduleId ? `/modules/${moduleId}/journey` : "/dashboard"}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.5} aria-hidden="true" />
            {moduleId ? "Kembali ke perjalanan" : "Kembali ke Beranda"}
          </Link>
        </Button>
      </header>
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-8 sm:px-10 sm:py-12 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-24 lg:px-16 lg:py-16">
        <nav aria-label="Tahap penguatan">
          <ol className="flex lg:block">
            {steps.map((label, index) => {
              const complete = step !== null && index < step;
              const active = index === step;
              return (
                <li
                  key={label}
                  aria-current={active ? "step" : undefined}
                  className="relative flex flex-1 gap-2 pb-0 text-xs lg:gap-3 lg:pb-7 lg:text-[13px]"
                >
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={`absolute top-7 bottom-0 left-[13px] hidden w-0.5 lg:block ${complete ? "bg-primary" : "bg-border"}`}
                    />
                  ) : null}
                  <span
                    className={`relative grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${active ? "border-primary bg-primary text-primary-foreground" : complete ? "border-primary bg-background text-link" : "border-border bg-background text-muted-foreground"}`}
                  >
                    {complete ? (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        size={16}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={`max-w-20 lg:max-w-none lg:pt-1 ${active ? "font-semibold" : "text-muted-foreground"}`}
                  >
                    {label}
                    {complete ? <span className="sr-only">, selesai</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-8 hidden max-w-36 text-xs leading-5 text-muted-foreground lg:block">
            Langkah kecil untuk pemahaman yang lebih kuat.
          </p>
        </nav>
        <section className="min-w-0 max-w-2xl" aria-labelledby="adaptive-heading">
          {children}
        </section>
      </div>
    </main>
  );
}
