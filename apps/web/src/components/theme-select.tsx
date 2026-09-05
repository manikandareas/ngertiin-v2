import { useEffect, useId, useState } from "react";

type Theme = "system" | "light" | "dark";
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

export function ThemeSelect() {
  const clipId = `theme-classic-${useId()}`;
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("ngertiin-theme");
      return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const dark = theme === "system" ? systemDark : theme === "dark";

  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(system.matches);
    update();
    system.addEventListener("change", update);
    return () => system.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("ngertiin-theme", theme);
    } catch {
      /* Theme remains usable without storage. */
    }
  }, [theme, dark]);

  const label = dark ? "Gunakan tema terang" : "Gunakan tema gelap";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
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
    </button>
  );
}
