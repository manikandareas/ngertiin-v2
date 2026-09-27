import type { Dashboard } from "@ngertiin/contracts/api";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChatMascot } from "../../chat/components/chat-mascot";
import { moduleOverviewRoute, nextLearningRoute } from "../../modules/next-learning-route";

export function DashboardWelcome({ data }: { data?: Dashboard }) {
  const resume = data?.continueLearning?.module;
  // Reset the typing frame when the greeting changes from loading to a module.
  return <WelcomeSentence key={`${resume?.id ?? "welcome"}:${Boolean(data)}`} data={data} />;
}

function WelcomeSentence({ data }: { data?: Dashboard }) {
  const resume = data?.continueLearning?.module;
  const title = resume?.title;
  const ready = resume?.status === "ready";
  const hasModules = Boolean(data?.modules.length);
  const lines = useMemo(() => {
    if (title) {
      return ready
        ? [
            `Terakhir kamu menjelajahi ${title}. Yuk, lanjut belajar!`,
            `Masih penasaran dengan ${title}? Kita cari jawabannya, yuk.`,
            `Satu langkah lagi di ${title}. Siap dapat momen “oh, ngerti!”?`,
          ]
        : [
            `${title} sedang disiapkan. Yuk, intip progresnya!`,
            `Rasa penasaranmu punya tempat di ${title}. Cek persiapannya, yuk.`,
            `Petualangan ${title} sebentar lagi dimulai. Lihat progresnya?`,
          ];
    }
    return hasModules
      ? [
          "Mau belajar apa hari ini? Yuk, pilih satu modul yang bikin penasaran!",
          "Satu langkah kecil, satu hal baru. Buka modulmu dan mulai, yuk.",
          "Momen “oh, ngerti!” berikutnya menunggu. Kita buka modulmu?",
        ]
      : [
          "Punya topik yang bikin penasaran? Yuk, buat modul pertamamu!",
          "Dari penasaran jadi paham. Mulai petualangan dengan satu modul, yuk.",
          "Hari ini mau ngerti apa? Bawa materimu, kita belajar bareng!",
        ];
  }, [title, ready, hasModules]);
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [frame, setFrame] = useState({ index: 0, length: 0, deleting: false });

  useEffect(() => {
    if (reducedMotion || focused) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      const complete = frame.length === lines[frame.index].length;
      timer = setTimeout(
        () => {
          setFrame((current) => {
            if (current.deleting) {
              return current.length === 0
                ? { index: (current.index + 1) % lines.length, length: 0, deleting: false }
                : { ...current, length: current.length - 1 };
            }
            return complete
              ? { ...current, deleting: true }
              : { ...current, length: current.length + 1 };
          });
        },
        frame.deleting ? 12 : complete ? 5500 : 35,
      );
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [frame, lines, reducedMotion, focused]);

  const destination = resume
    ? (nextLearningRoute(resume.nextAction) ?? moduleOverviewRoute(resume))
    : data?.modules.length
      ? "/modules"
      : "/modules/new";
  const sentence = reducedMotion ? lines[0] : lines[frame.index].slice(0, frame.length);

  return (
    <header className="mb-7 flex items-center gap-3 sm:gap-4 sm:w-fit">
      <ChatMascot variedIdle className="size-14 shrink-0 sm:size-16" />
      <Link
        to={destination}
        aria-label={reducedMotion ? lines[0] : lines[frame.index]}
        className="group relative grid min-w-0 flex-1 items-center rounded-[1.25rem] border-2 border-border bg-card px-4 py-3 pr-9 text-sm leading-relaxed text-foreground transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:px-5 sm:py-3.5 sm:pr-10 sm:text-base"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <span
          aria-hidden="true"
          className="absolute -left-[7px] top-1/2 size-3 -translate-y-1/2 rotate-45 rounded-bl-[3px] border-b-2 border-l-2 border-border bg-card transition-colors group-hover:border-primary/50"
        />
        {/* Reserve room for every sentence so the bubble stays still while typing. */}
        {lines.map((line) => (
          <span
            key={line}
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 break-words"
          >
            {line}
            <span className="inline-block w-2" />
          </span>
        ))}
        <span aria-hidden="true" className="col-start-1 row-start-1 break-words">
          {sentence}
          {!reducedMotion && (
            <span className="ml-0.5 inline-block h-[0.9em] w-0.5 translate-y-px rounded-full bg-primary" />
          )}
        </span>
        <span
          aria-hidden="true"
          className="absolute right-3 text-lg text-link transition-transform group-hover:translate-x-0.5 sm:right-4"
        >
          ↗
        </span>
      </Link>
    </header>
  );
}
