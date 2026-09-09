import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";
type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};
const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

function parseTheme(value: string | null, fallback: Theme): Theme {
  return value === "light" || value === "dark" || value === "system" ? value : fallback;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ngertiin-theme",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return parseTheme(localStorage.getItem(storageKey), defaultTheme);
    } catch {
      return defaultTheme;
    }
  });

  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const systemTheme = system.matches ? "dark" : "light";
      const resolved = theme === "system" ? systemTheme : theme;
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(resolved);
    };
    apply();
    if (theme !== "system") return;
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      // Cross-tab synchronization is unavailable when storage is blocked.
      return;
    }
    const sync = (event: StorageEvent) => {
      if (event.storageArea === storage && (event.key === storageKey || event.key === null)) {
        setThemeState(parseTheme(event.newValue, defaultTheme));
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey, defaultTheme]);

  const setTheme = (nextTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch {
      // Keep the theme usable when storage is unavailable.
    }
    setThemeState(nextTheme);
  };

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
