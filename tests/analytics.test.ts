import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAnalyticsEvents,
  scheduleFinderSearch,
  sanitiseAnalyticsEvent,
  type AnalyticsSender,
} from "@/lib/analytics";

describe("analytics privacy boundary", () => {
  it("retains validated campaign attribution and removes all other query data and fragments", () => {
    const event = sanitiseAnalyticsEvent({
      type: "pageview",
      url: "https://periodplace.org/find?utm_source=community_partner&utm_medium=referral&utm_campaign=edinburgh_pilot&utm_content=map_link&utm_term=free_products&q=EH1%201AA&email=person%40example.com#results",
    });

    expect(event).toEqual({
      type: "pageview",
      url: "https://periodplace.org/find?utm_source=community_partner&utm_medium=referral&utm_campaign=edinburgh_pilot&utm_content=map_link&utm_term=free_products",
    });
  });

  it("removes malformed or high-cardinality UTM values", () => {
    const event = sanitiseAnalyticsEvent({
      type: "pageview",
      url: `https://periodplace.org/find?utm_source=person%40example.com&utm_medium=paid%20social&utm_campaign=${"a".repeat(41)}&utm_content=valid_content&utm_term=EH1%201AA&query=tampons#results`,
    });

    expect(event).toEqual({
      type: "pageview",
      url: "https://periodplace.org/find?utm_content=valid_content",
    });
  });

  it.each([
    "https://periodplace.org/admin",
    "https://periodplace.org/admin/drafts/private-id",
    "https://periodplace.org/sign-in?redirect_url=%2Flocation%2Fleith-library",
  ])("does not collect page views from private routes: %s", (url) => {
    expect(sanitiseAnalyticsEvent({ type: "pageview", url })).toBeNull();
  });
});

describe("approved analytics events", () => {
  afterEach(() => vi.useRealTimers());

  function recordEvents() {
    const sent: Array<{ name: string; properties?: Record<string, string> }> = [];
    const send: AnalyticsSender = (name, properties) => sent.push({ name, properties });
    return { sent, events: createAnalyticsEvents(send) };
  }

  it("records a finder search with categorical properties and a separate zero-result signal", () => {
    const { sent, events } = recordEvents();

    events.finderSearch("combined", 0);

    expect(sent).toEqual([
      { name: "finder_search", properties: { search_mode: "combined", result_band: "zero" } },
      { name: "zero_results", properties: { search_mode: "combined" } },
    ]);
  });

  it("groups result counts into fixed bands", () => {
    const { sent, events } = recordEvents();

    events.finderSearch("filters", 1);
    events.finderSearch("location", 20);
    events.finderSearch("text", 21);

    expect(sent).toEqual([
      { name: "finder_search", properties: { search_mode: "filters", result_band: "one_to_five" } },
      { name: "finder_search", properties: { search_mode: "location", result_band: "six_to_twenty" } },
      { name: "finder_search", properties: { search_mode: "text", result_band: "over_twenty" } },
    ]);
  });

  it("exposes only the four remaining approved events without properties", () => {
    const { sent, events } = recordEvents();

    events.locationOpen();
    events.reportSubmitted();
    events.feedbackSubmitted();
    events.supportOutbound();

    expect(sent).toEqual([
      { name: "location_open", properties: undefined },
      { name: "report_submitted", properties: undefined },
      { name: "feedback_submitted", properties: undefined },
      { name: "support_outbound", properties: undefined },
    ]);
  });

  it("waits for a search to settle before recording it", () => {
    vi.useFakeTimers();
    const { sent, events } = recordEvents();

    scheduleFinderSearch(events, "text", 3);
    vi.advanceTimersByTime(749);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([
      { name: "finder_search", properties: { search_mode: "text", result_band: "one_to_five" } },
    ]);
  });

  it("cancels a pending partial search when the criteria change", () => {
    vi.useFakeTimers();
    const { sent, events } = recordEvents();

    const cancel = scheduleFinderSearch(events, "text", 0);
    cancel();
    vi.runAllTimers();

    expect(sent).toEqual([]);
  });
});
