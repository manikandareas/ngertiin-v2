import { cn } from "../../../lib/utils";
import { ClayAvatar, type ClayAvatarProps } from "./clay/clay-avatar";
import { resolveClayColor } from "./clay/engine";

type ChatMascotProps = Pick<ClayAvatarProps, "shape" | "face" | "color"> & {
  className?: string;
  thinking?: boolean;
};

export function ChatMascot({
  className,
  thinking = false,
  shape = "cloud",
  face = "neutral",
  color = "#1cb0f6",
}: ChatMascotProps) {
  const fill = resolveClayColor(color);

  return (
    <span className={cn("inline-flex shrink-0", className)} data-thinking={thinking}>
      {thinking ? (
        <svg className="size-full" viewBox="0 0 32 32" aria-hidden="true">
          {[7, 16, 25].map((cx, index) => (
            <circle
              key={cx}
              cx={cx}
              cy={16}
              r={3}
              fill={fill}
              className="origin-center opacity-55 [transform-box:fill-box] motion-safe:animate-[chat-mascot-thinking_1.5s_ease-in-out_infinite] motion-reduce:opacity-75"
              style={{ animationDelay: `${index * 0.5}s` }}
            />
          ))}
        </svg>
      ) : (
        <ClayAvatar className="size-full" shape={shape} face={face} color={color} track="cursor" />
      )}
    </span>
  );
}
