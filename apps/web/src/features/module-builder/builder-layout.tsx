import { ArrowLeft01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";

const steps = ["Materi", "Fokus belajar", "Tinjau modul", "Pembuatan", "Siap belajar"];
const headings = [
  "Tambahkan materi",
  "Atur fokus belajar",
  "Tinjau modul",
  "Menyusun modulmu",
  "Modulmu siap dipelajari",
];
const descriptions = [
  "Kumpulkan bahan belajarmu. Kami bantu menyusunnya menjadi langkah-langkah kecil yang mudah dipahami.",
  "Beri sedikit arahan agar belajarmu lebih terarah. Langkah ini boleh dilewati.",
  "Pastikan materi dan fokusnya sudah sesuai. Setelah ini, biarkan kami menyusun alur belajarmu.",
  "Dari materi menjadi perjalanan belajar. Ikuti setiap langkahnya di sini.",
  "Satu langkah kecil hari ini, satu hal baru yang kamu pahami.",
];

export function BuilderLayout({
  step,
  onStep,
  children,
  footer,
}: {
  step: number;
  onStep?: (step: number) => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step >= 0) heading.current?.focus({ preventScroll: true });
  }, [step]);
  return (
    <main className="builder-controls min-h-dvh w-full bg-background text-foreground">
      <div className="min-h-dvh w-full">
        <header className="flex h-12 items-center border-b border-muted px-4 sm:px-8">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 text-xs font-medium normal-case text-muted-foreground"
          >
            <Link to="/dashboard">
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              Kembali ke Beranda
            </Link>
          </Button>
        </header>
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-8 sm:px-10 sm:py-12 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-24 lg:px-16 lg:py-16">
          <nav aria-label="Langkah pembuatan modul">
            <p className="mb-4 text-xs font-medium text-muted-foreground lg:hidden">
              Langkah {step + 1} dari 5 · {steps[step]}
            </p>
            <ol className="flex lg:block">
              {steps.map((label, index) => (
                <li
                  key={label}
                  className="relative flex-1 pb-0 after:absolute after:top-[13px] after:right-0 after:left-7 after:h-0.5 after:bg-border after:content-[''] last:after:hidden data-[complete=true]:after:bg-primary lg:pb-6 lg:after:top-7 lg:after:right-auto lg:after:left-[13px] lg:after:h-[calc(100%-28px)] lg:after:w-0.5"
                  data-complete={index < step}
                >
                  <button
                    type="button"
                    disabled={!onStep || index >= step}
                    onClick={() => onStep?.(index)}
                    aria-current={index === step ? "step" : undefined}
                    aria-label={`${index + 1}. ${label}${index < step ? ", selesai" : ""}`}
                    className="relative z-1 flex items-center gap-3 rounded-sm text-left text-[13px] focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${index === step ? "border-primary bg-primary text-primary-foreground" : index < step ? "border-primary bg-background text-link" : "border-border bg-background text-muted-foreground"}`}
                    >
                      {index < step ? (
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          size={16}
                          strokeWidth={1.5}
                          className="size-4"
                          aria-hidden="true"
                        />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={`hidden lg:block ${index === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {label}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <section className="min-w-0 max-w-2xl" aria-labelledby="builder-heading">
            <header className="mb-9 sm:mb-10">
              <h1
                ref={heading}
                tabIndex={-1}
                id="builder-heading"
                className="font-display text-2xl font-bold leading-tight tracking-tight outline-none"
              >
                {headings[step]}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {descriptions[step]}
              </p>
            </header>
            <div key={step} className="motion-safe:animate-builder-enter">
              {children}
            </div>
            {footer ? (
              <footer className="mt-10 flex items-center justify-between gap-4 border-t border-muted pt-6 sm:mt-12">
                {footer}
              </footer>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
