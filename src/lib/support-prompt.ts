export const SUPPORT_PROMPT_STORAGE_KEY = "period-place-support-prompt-dismissed";
export const SUPPORT_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

const excludedPrefixes = ["/support", "/admin", "/sign-in", "/privacy", "/contact"];

export function shouldShowSupportPrompt(dismissedAt: string | null, now: number): boolean {
  if (!dismissedAt) return true;
  const timestamp = Number(dismissedAt);
  return !Number.isFinite(timestamp) || now - timestamp >= SUPPORT_PROMPT_INTERVAL_MS;
}

export function isSupportPromptExcluded(pathname: string): boolean {
  return excludedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
