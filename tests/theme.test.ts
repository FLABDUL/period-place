import { describe, expect, it } from "vitest";
import { resolveTheme, THEME_STORAGE_KEY } from "@/lib/theme";

describe("theme preference", () => {
  it("uses a saved theme before the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("uses the system preference when no valid value is saved", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme("unexpected", false)).toBe("light");
    expect(THEME_STORAGE_KEY).toBe("period-place-theme");
  });
});
