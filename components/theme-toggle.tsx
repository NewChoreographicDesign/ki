"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

export type { Theme };
// Broadcast on <html> so any client component (e.g. the toast layer, which
// mounts once at the root and can't just re-read the DOM on every render)
// can react to a toggle without a shared React context wrapping the whole
// app just for this one value.
const THEME_CHANGE_EVENT = "themechange";

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing / storage disabled — theme still applies for this
    // page load, it just won't persist across visits.
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
}

function readCurrentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Re-renders whenever the theme changes, including from outside this component. */
export function useTheme(): Theme {
  const [theme, setTheme] = React.useState<Theme>("light");

  React.useEffect(() => {
    setTheme(readCurrentTheme());
    function onChange(e: Event) {
      setTheme((e as CustomEvent<Theme>).detail);
    }
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  return theme;
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Lichte modus" : "Donkere modus"}
      title={theme === "dark" ? "Lichte modus" : "Donkere modus"}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
