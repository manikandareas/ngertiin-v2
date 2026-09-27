import { ArrowLeft01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

export function CreationLayout({
  steps,
  step,
  onStep,
  title,
  description,
  backTo,
  backLabel,
  children,
  footer,
}: {
  steps: string[];
  step: number;
  onStep?: (step: number) => void;
  title: string;
  description: string;
  backTo: string;
  backLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step >= 0) {
      heading.current?.focus({ preventScroll: true });
      scroll.current?.scrollTo({ top: 0 });
    }
  }, [step]);
  return (
    <div className="creation-controls flex min-h-0 flex-1 flex-col text-foreground">
      <header className="z-20 flex h-12 shrink-0 items-center border-b border-muted bg-background px-4 sm:px-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 text-xs font-medium normal-case text-muted-foreground"
        >
          <Link to={backTo}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.5} aria-hidden="true" />
            {backLabel}
          </Link>
        </Button>
      </header>
      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-10 lg:py-16 2xl:gap-16 2xl:px-12">
          <nav aria-label="Langkah pembuatan" className="lg:sticky lg:top-8 lg:self-start">
            <p className="mb-4 text-xs font-medium text-muted-foreground lg:hidden">
              Langkah {step + 1} dari {steps.length} · {steps[step]}
            </p>
            <ol className="flex lg:block">
              {steps.map((label, index) => (
                <li
                  key={label}
                  data-complete={index < step}
                  className="relative flex-1 after:absolute after:top-[13px] after:right-0 after:left-7 after:h-0.5 after:bg-border last:after:hidden data-[complete=true]:after:bg-primary lg:pb-6 lg:after:top-7 lg:after:right-auto lg:after:left-[13px] lg:after:h-[calc(100%-28px)] lg:after:w-0.5"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!onStep || index >= step}
                    onClick={() => onStep?.(index)}
                    aria-current={index === step ? "step" : undefined}
                    aria-label={`${index + 1}. ${label}${index < step ? ", selesai" : ""}`}
                    className="relative z-1 h-auto justify-start gap-3 rounded-sm border-0 p-0 text-left text-[13px] hover:bg-transparent disabled:opacity-100"
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${index === step ? "border-primary bg-primary text-primary-foreground" : index < step ? "border-primary bg-background text-link" : "border-border bg-background text-muted-foreground"}`}
                    >
                      {index < step ? (
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
                      className={`hidden lg:block ${index === step ? "font-semibold text-foreground" : "font-normal text-muted-foreground"}`}
                    >
                      {label}
                    </span>
                  </Button>
                </li>
              ))}
            </ol>
          </nav>
          <section className="min-w-0" aria-labelledby={headingId}>
            <div className="mb-9 sm:mb-10">
              <h1
                ref={heading}
                id={headingId}
                tabIndex={-1}
                className="font-display text-2xl font-bold leading-tight tracking-tight outline-none"
              >
                {title}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {children}
            {footer ? (
              <footer className="mt-10 flex items-center justify-between gap-4 border-t border-muted pt-6 sm:mt-12">
                {footer}
              </footer>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
