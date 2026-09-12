import type { PublicActivity } from "@ngertiin/contracts/api";
import { X } from "lucide-react";
import type { JSX, ReactNode, Ref } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../../../components/theme-toggle";
import { Button } from "../../../components/ui/button";
import type { AttemptTone } from "../attempt-presentation";
import { AttemptEnvironment } from "./attempt-environment";
import styles from "./node-player.module.css";
import { NodePlayerSidebar } from "./node-player-sidebar";

interface NodePlayerLayoutProps {
  moduleId: string;
  title: string;
  activities: PublicActivity[];
  slide: number;
  showResult: boolean;
  resultTone?: AttemptTone;
  animateResult: boolean;
  contentRef: Ref<HTMLDivElement>;
  children: ReactNode;
  footer: ReactNode;
  rightSidebar?: ReactNode;
}

export function NodePlayerLayout({
  moduleId,
  title,
  activities,
  slide,
  showResult,
  resultTone,
  animateResult,
  contentRef,
  children,
  footer,
  rightSidebar,
}: NodePlayerLayoutProps): JSX.Element {
  return (
    <div className="fixed inset-0 flex h-dvh overflow-hidden bg-background">
      <div
        className={`${styles.container} flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background px-6 text-foreground sm:px-10 lg:px-12`}
      >
        {resultTone ? <AttemptEnvironment tone={resultTone} animate={animateResult} /> : null}
        <header className="sticky top-0 z-20 -mx-6 bg-background px-6 sm:-mx-10 sm:px-10 lg:-mx-12 lg:px-12">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between py-1 sm:py-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="icon" className="rounded-full">
              <Link
                aria-label="Keluar dari node dan kembali ke Journey"
                to={`/modules/${moduleId}/journey`}
              >
                <X />
              </Link>
            </Button>
          </div>
        </header>
        <div
          className={`${styles.layout} mx-auto grid w-full max-w-7xl flex-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12 md:pt-10 lg:gap-24 lg:pt-16`}
        >
          <NodePlayerSidebar
            title={title}
            activities={activities}
            slide={slide}
            showResult={showResult}
          />
          <main className="-mx-6 flex min-w-0 flex-col md:mx-0 md:min-h-[calc(100dvh-8rem)] lg:min-h-[calc(100dvh-10rem)]">
            <div
              ref={contentRef}
              tabIndex={-1}
              className="flex-1 scroll-mt-20 px-6 pb-10 outline-none [overflow-wrap:anywhere] md:pb-16"
            >
              <div className="mx-auto w-full max-w-xl">{children}</div>
            </div>
            {footer}
          </main>
        </div>
      </div>
      {rightSidebar}
    </div>
  );
}
