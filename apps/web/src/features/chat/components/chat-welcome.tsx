import { BulbIcon, Chat01Icon, TextAlignLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChatMascot } from "./chat-mascot";

type ChatWelcomeProps = {
  onSuggest: (text: string) => void;
  disabled?: boolean;
};

export function ChatWelcome({ onSuggest, disabled = false }: ChatWelcomeProps) {
  return (
    <div className="mt-auto pb-3 pt-8">
      <ChatMascot className="-ml-1 size-18" />
      <h3 className="mt-5 font-display text-[26px] font-extrabold leading-tight tracking-tight">
        Mau memahami apa
        <br />
        hari ini?
      </h3>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Kita pelajari pelan-pelan, sampai kamu paham.
      </p>
      <div className="mt-6 space-y-1">
        {[
          {
            icon: BulbIcon,
            text: "Jelaskan dengan lebih sederhana",
            prompt: "Jelaskan materi ini dengan lebih sederhana",
          },
          {
            icon: Chat01Icon,
            text: "Beri contoh sehari-hari",
            prompt: "Beri aku contoh dari kehidupan sehari-hari",
          },
          {
            icon: TextAlignLeftIcon,
            text: "Temukan inti materi ini",
            prompt: "Apa inti dari materi ini?",
          },
        ].map(({ icon, text, prompt }) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onSuggest(prompt)}
            className="-ml-2 flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <HugeiconsIcon
              icon={icon}
              size={20}
              strokeWidth={1.5}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
