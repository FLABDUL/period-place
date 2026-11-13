"use client";

import { useSyncExternalStore } from "react";
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

function currentTheme(): Theme {
  try {
    return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY), window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (callback) => {
      window.addEventListener("period-place-theme-change", callback);
      return () => window.removeEventListener("period-place-theme-change", callback);
    },
    currentTheme,
    () => "light",
  );

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
    window.dispatchEvent(new Event("period-place-theme-change"));
  }

  const nextLabel = theme === "dark" ? "Use light theme" : "Use dark theme";
  return <button className="theme-toggle" type="button" aria-label={nextLabel} title={nextLabel} onClick={toggleTheme}>
    <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    <span className="theme-label">{theme === "dark" ? "Light" : "Dark"}</span>
  </button>;
}
