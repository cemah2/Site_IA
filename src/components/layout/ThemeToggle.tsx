"use client";

import * as React from "react";
import { applyPaletteTheme } from "@/lib/viz/palette";
import { applyTheme, getTheme, subscribeTheme, type ThemeName } from "@/lib/viz/theme";

/**
 * Switch between the two themes.
 *
 * The drawing colours live in JavaScript (canvas cannot read CSS custom
 * properties), so flipping the theme has to update them too — and anything
 * that already memoised a colour has to be thrown away. `useTheme` below hands
 * the shell a key for exactly that purpose.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={className}
      aria-label={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
      title={
        theme === "dark"
          ? "Thème clair — pour projeter en salle éclairée"
          : "Thème sombre"
      }
    >
      <span aria-hidden>{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}

export function setTheme(next: ThemeName): void {
  applyPaletteTheme(next);
  applyTheme(next);
}

/** The active theme, as external state — it is owned by the document, not React. */
export function useTheme(): ThemeName {
  return React.useSyncExternalStore(subscribeTheme, getTheme, () => "dark" as ThemeName);
}
