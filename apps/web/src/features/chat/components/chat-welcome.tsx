import { BulbIcon, Chat01Icon, TextAlignLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { ChatMascot } from "./chat-mascot";

type ChatWelcomeProps = {
  onSuggest: (text: string) => void;
  disabled?: boolean;
  standalone?: boolean;
  fullPage?: boolean;
  children?: ReactNode;
  idlePaused?: boolean;
};

export function ChatWelcome({
  onSuggest,
  disabled = false,
  standalone = false,
  fullPage = false,
  children,
  idlePaused = false,
}: ChatWelcomeProps) {
  const suggestions = [
    {
      icon: BulbIcon,
      compactLabel: "Jelaskan konsep",
      text: standalone ? "Kenapa langit berwarna biru?" : "Jelaskan dengan lebih sederhana",
      prompt: standalone
        ? "Kenapa langit berwarna biru?"
        : "Jelaskan materi ini dengan lebih sederhana",
    },
    {
      icon: Chat01Icon,
      compactLabel: "Beri contoh",
      text: standalone ? "Apa itu berpikir kritis?" : "Beri contoh sehari-hari",
      prompt: standalone
        ? "Jelaskan berpikir kritis dengan contoh sehari-hari"
        : "Beri aku contoh dari kehidupan sehari-hari",
    },
    {
      icon: TextAlignLeftIcon,
      compactLabel: standalone ? "Mulai topik baru" : "Ringkas materi",
      text: standalone ? "Bantu aku mulai belajar topik baru" : "Temukan inti materi ini",
      prompt: standalone ? "Bantu aku mulai belajar topik baru" : "Apa inti dari materi ini?",
    },
  ];

  return (
    <div className={fullPage ? "w-full text-center" : "mt-auto pb-3 pt-8"}>
      <ChatMascot
        className={fullPage ? "mx-auto size-18" : "-ml-1 size-18"}
        variedIdle={fullPage && !disabled && !idlePaused}
      />
      <h2
        className={
          fullPage
            ? "mt-5 text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl"
            : "mt-5 font-display text-[26px] font-extrabold leading-tight tracking-tight"
        }
      >
        Mau memahami apa{fullPage ? " " : <br />}hari ini?
      </h2>
      {!fullPage ? (
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          Kita pelajari pelan-pelan, sampai kamu paham.
        </p>
      ) : null}
      {children}
      <div
        className={
          fullPage ? "mt-5 flex flex-wrap justify-center gap-x-3 gap-y-1 sm:mt-6" : "mt-6 space-y-1"
        }
      >
        {suggestions.map(({ icon, text, compactLabel, prompt }) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onSuggest(prompt)}
            className={
              fullPage
                ? "flex min-h-11 items-center gap-2 rounded-button px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                : "-ml-2 flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            }
          >
            <HugeiconsIcon
              icon={icon}
              size={20}
              strokeWidth={1.5}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            {fullPage ? compactLabel : text}
          </button>
        ))}
      </div>
    </div>
  );
}
