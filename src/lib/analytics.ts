import { track } from "@vercel/analytics";
import type { BeforeSendEvent } from "@vercel/analytics/next";

export type AnalyticsSender = (name: string, properties?: Record<string, string>) => void;
export type FinderSearchMode = "text" | "filters" | "location" | "combined";

const privateRoute = /^\/(?:admin|sign-in)(?:\/|$)/;
const allowedUtmParameters = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
const categoricalUtmValue = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export function sanitiseAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    if (privateRoute.test(url.pathname)) return null;

    const retainedParameters = new URLSearchParams();
    for (const parameter of allowedUtmParameters) {
      const value = url.searchParams.get(parameter);
      if (value && categoricalUtmValue.test(value)) {
        retainedParameters.set(parameter, value);
      }
    }

    url.search = retainedParameters.toString();
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

function resultBand(totalMatches: number) {
  if (totalMatches <= 0) return "zero";
  if (totalMatches <= 5) return "one_to_five";
  if (totalMatches <= 20) return "six_to_twenty";
  return "over_twenty";
}

export function createAnalyticsEvents(send: AnalyticsSender) {
  return {
    finderSearch(searchMode: FinderSearchMode, totalMatches: number) {
      send("finder_search", { search_mode: searchMode, result_band: resultBand(totalMatches) });
      if (totalMatches === 0) send("zero_results", { search_mode: searchMode });
    },
    locationOpen() { send("location_open"); },
    reportSubmitted() { send("report_submitted"); },
    feedbackSubmitted() { send("feedback_submitted"); },
    supportOutbound() { send("support_outbound"); },
  };
}

export const analyticsEvents = createAnalyticsEvents(track);

export function scheduleFinderSearch(events: Pick<ReturnType<typeof createAnalyticsEvents>, "finderSearch">, searchMode: FinderSearchMode, totalMatches: number) {
  const timer = setTimeout(() => events.finderSearch(searchMode, totalMatches), 750);
  return () => clearTimeout(timer);
}
