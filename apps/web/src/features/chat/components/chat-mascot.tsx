import { cn } from "../../../lib/utils";

type ChatMascotProps = {
  className?: string;
  thinking?: boolean;
};

export function ChatMascot({ className, thinking = false }: ChatMascotProps) {
  return (
    <span className={cn("group/mascot inline-flex shrink-0", className)} data-thinking={thinking}>
      <svg viewBox="0 0 100 100" className="size-full overflow-visible" aria-hidden="true">
        <g className="origin-[50px_65px] motion-safe:animate-[chat-mascot-breathe_6.4s_ease-in-out_infinite] motion-safe:group-hover/mascot:animate-[chat-mascot-hello_0.7s_ease-in-out_infinite_alternate] motion-safe:group-hover/chat-trigger:animate-[chat-mascot-hello_0.7s_ease-in-out_infinite_alternate] motion-safe:group-focus-visible/chat-trigger:animate-[chat-mascot-hello_0.7s_ease-in-out_infinite_alternate]">
          <path
            fill="var(--primary)"
            d="M25 79C4 79 2 53 19 45C13 25 35 13 48 25C60 7 85 19 81 40C101 48 96 75 80 78C65 92 45 86 40 81Z"
          />
          <g transform="translate(2 4) rotate(-10 50 45)">
            <g
              className={cn(
                "origin-[50px_45px]",
                thinking
                  ? "motion-safe:animate-[chat-mascot-look_2.8s_ease-in-out_infinite]"
                  : "motion-safe:animate-[chat-mascot-look_9s_ease-in-out_infinite]",
              )}
            >
              <g
                className="origin-[50px_43px] group-hover/mascot:opacity-0 group-hover/chat-trigger:opacity-0 group-focus-visible/chat-trigger:opacity-0 motion-safe:animate-[chat-mascot-blink_6s_infinite]"
                fill="#13222c"
              >
                <rect x="43" y="33" width="7" height="15" rx="3.5" />
                <rect x="60" y="33" width="7" height="15" rx="3.5" />
              </g>
              <g
                className="opacity-0 group-hover/mascot:opacity-100 group-hover/chat-trigger:opacity-100 group-focus-visible/chat-trigger:opacity-100"
                fill="none"
                stroke="#13222c"
                strokeWidth="5"
                strokeLinecap="round"
              >
                <path d="M42 42Q46 32 50 42M59 42Q63 32 67 42" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}
