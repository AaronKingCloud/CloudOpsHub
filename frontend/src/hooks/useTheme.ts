import { useEffect, useState } from "react";

// "system" follows the OS setting; "light" / "dark" override it.
export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "cloudopshub_theme";
const ORDER: ThemeChoice[] = ["system", "light", "dark"];

function readStoredTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

// Sets data-theme on <html>; the colour tokens in index.css react to it.
export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (private mode): the choice just isn't remembered.
    }
  }, [theme]);

  const cycleTheme = () => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]);

  return { theme, cycleTheme };
}
