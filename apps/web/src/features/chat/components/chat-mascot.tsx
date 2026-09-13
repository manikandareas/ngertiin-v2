import { useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { ClayAvatar, type ClayAvatarProps } from "./clay/clay-avatar";
import { type FaceId, resolveClayColor } from "./clay/engine";

const IDLE_GESTURES = [
  { face: "happy", motion: "motion-safe:animate-[chat-mascot-nod_2.4s_ease-in-out]" },
  { face: "attentive", motion: "motion-safe:animate-[chat-mascot-tilt_2.4s_ease-in-out]" },
  { face: "sleepy", motion: "motion-safe:animate-[chat-mascot-sway_2.4s_ease-in-out]" },
  { face: "wink", motion: "motion-safe:animate-[chat-mascot-tilt_2.4s_ease-in-out]" },
  { face: "surprised", motion: "motion-safe:animate-[chat-mascot-lift_2.4s_ease-in-out]" },
  { face: "happy", motion: "motion-safe:animate-[chat-mascot-sway_2.4s_ease-in-out]" },
] satisfies { face: FaceId; motion: string }[];

type ChatMascotProps = Pick<ClayAvatarProps, "shape" | "face" | "color"> & {
  className?: string;
  thinking?: boolean;
  variedIdle?: boolean;
};

export function ChatMascot({
  className,
  thinking = false,
  variedIdle = false,
  shape = "cloud",
  face = "neutral",
  color = "#1cb0f6",
}: ChatMascotProps) {
  const fill = resolveClayColor(color);
  const root = useRef<HTMLSpanElement>(null);
  const [gesture, setGesture] = useState<(typeof IDLE_GESTURES)[number] | null>(null);

  useEffect(() => {
    if (!variedIdle || thinking || !root.current) {
      setGesture(null);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = false;
    let previous = -1;

    function schedule() {
      clearTimeout(timer);
      setGesture(null);
      if (!visible || document.hidden || reduced.matches) return;
      timer = setTimeout(
        () => {
          // Choose a different gesture each time without a predictable loop.
          const offset = 1 + Math.floor(Math.random() * (IDLE_GESTURES.length - 1));
          previous =
            previous < 0
              ? Math.floor(Math.random() * IDLE_GESTURES.length)
              : (previous + offset) % IDLE_GESTURES.length;
          setGesture(IDLE_GESTURES[previous]);
          timer = setTimeout(schedule, 2400);
        },
        4500 + Math.random() * 4500,
      );
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    observer.observe(root.current);
    document.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, [variedIdle, thinking]);

  const activeGesture = variedIdle && !thinking ? gesture : null;

  return (
    <span ref={root} className={cn("inline-flex shrink-0", className)} data-thinking={thinking}>
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
        <ClayAvatar
          className={cn("size-full", activeGesture?.motion)}
          shape={shape}
          face={activeGesture?.face ?? face}
          color={color}
          track="cursor"
        />
      )}
    </span>
  );
}
