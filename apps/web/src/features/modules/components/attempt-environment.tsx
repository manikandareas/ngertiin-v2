import type { CSSProperties, JSX } from "react";
import type { AttemptTone } from "../attempt-presentation";

const particles = Array.from({ length: 36 }, (_, index) => ({
  id: index,
  style: {
    "--confetti-x": `${Math.sin(index * 2.4) * 42}vw`,
    "--confetti-y": `${25 + ((index * 17) % 45)}vh`,
    "--confetti-rotation": `${index * 71}deg`,
    animationDelay: `${(index % 5) * 25}ms`,
  } as CSSProperties,
}));

interface AttemptEnvironmentProps {
  tone: AttemptTone;
  animate: boolean;
}

export function AttemptEnvironment({ tone, animate }: AttemptEnvironmentProps): JSX.Element {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <div
        className="attempt-environment absolute inset-1.5 rounded-card border-2 sm:inset-3"
        data-attempt-tone={tone}
        data-animate={animate || undefined}
      />
      {tone === "success" && animate ? (
        <div className="motion-reduce:hidden">
          {particles.map((particle) => (
            <span
              key={particle.id}
              className="attempt-confetti absolute left-1/2 top-1/4 h-3 w-1.5 rounded-xs"
              style={particle.style}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
