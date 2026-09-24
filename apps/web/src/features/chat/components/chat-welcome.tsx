import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ChatMascot } from "./chat-mascot";
import { ChatSuggestions } from "./chat-suggestions";

type ChatWelcomeProps = {
  onSuggest: (text: string) => void;
  disabled?: boolean;
  standalone?: boolean;
  fullPage?: boolean;
  idlePaused?: boolean;
};

const TITLES = [
  "Mau memahami apa hari ini?",
  "Ada yang bikin penasaran?",
  "Yuk, belajar sampai paham.",
];

function RotatingTitle() {
  const reducedMotion = useReducedMotion();
  const [frame, setFrame] = useState({ index: 0, length: TITLES[0].length, deleting: false });

  useEffect(() => {
    if (reducedMotion) return;
    const title = TITLES[frame.index];
    const complete = frame.length === title.length;
    const timer = window.setTimeout(
      () => {
        setFrame((current) => {
          if (current.deleting) {
            if (current.length === 0) {
              return { index: (current.index + 1) % TITLES.length, length: 0, deleting: false };
            }
            return { ...current, length: current.length - 1 };
          }
          if (complete) return { ...current, deleting: true };
          return { ...current, length: current.length + 1 };
        });
      },
      frame.deleting ? 35 : complete ? 3200 : 75,
    );
    return () => window.clearTimeout(timer);
  }, [frame, reducedMotion]);

  return (
    <h2 className="relative font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
      <span className="sr-only">{TITLES[0]}</span>
      <span aria-hidden="true" className="grid">
        {TITLES.map((title) => (
          <span key={title} className="invisible col-start-1 row-start-1 px-2">
            {title}
          </span>
        ))}
        <span className="col-start-1 row-start-1">
          {reducedMotion ? TITLES[0] : TITLES[frame.index].slice(0, frame.length)}
          {!reducedMotion && (
            <span className="ml-0.5 inline-block h-[0.85em] w-0.5 translate-y-px rounded-full bg-primary" />
          )}
        </span>
      </span>
    </h2>
  );
}

export function ChatWelcome({
  onSuggest,
  disabled = false,
  standalone = false,
  fullPage = false,
  idlePaused = false,
}: ChatWelcomeProps) {
  return (
    <div
      className={
        fullPage ? "w-full -translate-y-12 text-center md:-translate-y-24" : "mt-auto pb-3 pt-8"
      }
    >
      <ChatMascot
        className={fullPage ? "mx-auto size-28" : "-ml-1 size-18"}
        variedIdle={fullPage && !disabled && !idlePaused}
      />
      {fullPage ? (
        <RotatingTitle />
      ) : (
        <h2 className="mt-5 font-display text-[26px] font-extrabold leading-tight tracking-tight">
          Mau memahami apa
          <br />
          hari ini?
        </h2>
      )}
      {!fullPage ? (
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          Kita pelajari pelan-pelan, sampai kamu paham.
        </p>
      ) : null}
      <ChatSuggestions
        onSuggest={onSuggest}
        disabled={disabled}
        standalone={standalone}
        fullPage={fullPage}
      />
    </div>
  );
}
