export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "period-place-theme";

export function resolveTheme(saved: string | null, systemPrefersDark: boolean): Theme {
  if (saved === "light" || saved === "dark") return saved;
  return systemPrefersDark ? "dark" : "light";
}
