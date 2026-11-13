import { describe, expect, it } from "vitest";
import { isSupportPromptExcluded, shouldShowSupportPrompt } from "@/lib/support-prompt";

describe("support prompt", () => {
  it("waits one day after dismissal", () => {
    const now = Date.UTC(2026, 8, 16);
    const oneDay = 24 * 60 * 60 * 1000;
    expect(shouldShowSupportPrompt(null, now)).toBe(true);
    expect(shouldShowSupportPrompt(String(now - oneDay + 1), now)).toBe(false);
    expect(shouldShowSupportPrompt(String(now - oneDay), now)).toBe(true);
  });

  it("fails open when storage contains an invalid value", () => {
    expect(shouldShowSupportPrompt("not-a-date", Date.now())).toBe(true);
  });

  it("does not interrupt sensitive or support pages", () => {
    for (const path of ["/support", "/admin", "/admin/login", "/sign-in", "/privacy", "/contact"]) {
      expect(isSupportPromptExcluded(path)).toBe(true);
    }
    expect(isSupportPromptExcluded("/find")).toBe(false);
  });
});
