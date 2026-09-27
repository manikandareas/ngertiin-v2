import { useEffect, useState } from "react";
import stylesheet from "../../index.css?raw";

// Discover the actual palette rather than maintaining a second copy of its values.
const names = [
  ...new Set(
    [...stylesheet.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)]
      .filter(([, , value]) =>
        /^(#[\da-f]+|var\(--(?:background|foreground|primary|secondary|accent|muted|border|ring|adaptive|success))/i.test(
          value.trim(),
        ),
      )
      .map(([, name]) => name),
  ),
];

export function ColorTokens() {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const update = () => {
      const styles = getComputedStyle(document.documentElement);
      setValues(
        Object.fromEntries(
          names.map((name) => [name, styles.getPropertyValue(`--${name}`).trim()]),
        ),
      );
    };
    const frame = requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {names
        .filter((name) => values[name])
        .map((name) => (
          <div key={name} className="min-w-0">
            <div
              className="mb-2 h-16 rounded-lg border border-input/40"
              style={{ backgroundColor: `var(--${name})` }}
            />
            <p className="break-words font-mono text-xs">--{name}</p>
            <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
              {values[name]}
            </p>
          </div>
        ))}
    </div>
  );
}
