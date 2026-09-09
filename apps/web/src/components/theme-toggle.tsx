import { Monitor } from "lucide-react";
import { useId } from "react";
import { cn } from "../lib/utils";
import { useTheme } from "./theme-provider";
import { DropdownMenuItem } from "./ui/dropdown-menu";

const rays = [
  "M12 1.4v2.4",
  "m20.3 3.7-2.5 2.5",
  "M22.6 12h-2.4",
  "M12 22.6v-2.4",
  "M1.4 12h2.4",
  "m20.3 20.3-2.5-2.5",
  "m3.7 20.3 2.5-2.5",
  "m3.7 3.7 2.5 2.5",
];

const modes = {
  system: { label: "Sistem", next: "light" },
  light: { label: "Terang", next: "dark" },
  dark: { label: "Gelap", next: "system" },
} as const;

export function ThemeToggle({ variant = "button" }: { variant?: "button" | "menu" }) {
  const clipId = `theme-classic-${useId()}`;
  const { theme, setTheme } = useTheme();
  const mode = modes[theme];
  const label = `Tema ${mode.label.toLowerCase()}. Gunakan tema ${modes[mode.next].label.toLowerCase()}`;
  const toggle = () => setTheme(mode.next);
  const icon = (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center",
        variant === "menu" ? "size-5" : "size-6",
      )}
    >
      <Monitor
        strokeWidth={1.5}
        className={cn(
          "absolute size-full transition-[transform,opacity] duration-400 ease-out motion-reduce:transition-none",
          theme === "system" ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-12 opacity-0",
        )}
      />
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className={cn(
          "absolute size-full transition-[transform,opacity] duration-400 ease-out motion-reduce:transition-none",
          theme === "system" ? "scale-75 rotate-12 opacity-0" : "scale-100 rotate-0 opacity-100",
        )}
      >
        <defs>
          <clipPath id={clipId}>
            <path
              d="M0 0h25a1 1 0 0010 10v14H0Z"
              className="transition-[d,translate] duration-400 dark:delay-60 dark:[d:path('M0_2h13a1_1_0_0010_10v14H0Z')] dark:not-supports-[d:path('M0_0')]:-translate-x-3.25 dark:not-supports-[d:path('M0_0')]:translate-y-0.5 motion-reduce:transition-none motion-reduce:delay-0"
            />
          </clipPath>
        </defs>
        <g stroke="currentColor" strokeLinecap="round">
          <circle
            cx="12"
            cy="12"
            r="5"
            fill="currentColor"
            clipPath={`url(#${clipId})`}
            className="origin-center transition-transform duration-400 dark:scale-170 motion-reduce:transition-none"
          />
          {rays.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeMiterlimit="0"
              paintOrder="stroke markers fill"
              className="[transform-box:view-box] origin-center transition-[transform,opacity] duration-400 delay-60 dark:delay-0 dark:scale-0 dark:opacity-0 motion-reduce:transition-none motion-reduce:delay-0"
            />
          ))}
        </g>
      </svg>
    </span>
  );
  if (variant === "menu") {
    return (
      <DropdownMenuItem
        aria-label={label}
        title={label}
        onSelect={(event) => {
          event.preventDefault();
          toggle();
        }}
      >
        {icon}
        Tema
        <span className="ml-auto text-xs text-muted-foreground">{mode.label}</span>
      </DropdownMenuItem>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      className="grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {icon}
    </button>
  );
}
