import { describe, expect, test } from "vitest";
import type { FeedbackRecord } from "@/lib/db";

function feedback(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: "feedback-1",
    createdAt: "2026-09-14T12:00:00.000Z",
    usefulness: 5,
    foundWhatNeeded: "yes",
    trustedResults: "yes",
    submittedUpdate: "not_tried",
    wouldUseAgain: "yes",
    comments: "Clear and useful.",
    excludedAt: null,
    excludedBy: null,
    ...overrides,
  };
}

async function reportingModule() {
  try {
    return await import("@/lib/beta-reporting");
  } catch {
    return null;
  }
}

describe("summariseBetaFeedback", () => {
  test("ignores excluded test responses when calculating beta review signals", async () => {
    const reporting = await reportingModule();
    expect(reporting).not.toBeNull();

    expect(reporting!.summariseBetaFeedback([
      feedback(),
      feedback({ id: "feedback-2", usefulness: 1, foundWhatNeeded: "no", trustedResults: "no", wouldUseAgain: "no", comments: "testing", excludedAt: "2026-09-15T12:00:00.000Z", excludedBy: "admin@example.invalid" }),
    ])).toEqual({
      total: 1,
      excluded: 1,
      averageUsefulness: 5,
      foundWhatNeededPercent: 100,
      trustedResultsPercent: 100,
      wouldUseAgainPercent: 100,
    });
  });

  test("returns an explicit empty state before included feedback arrives", async () => {
    const reporting = await reportingModule();
    expect(reporting).not.toBeNull();

    expect(reporting!.summariseBetaFeedback([])).toEqual({
      total: 0,
      excluded: 0,
      averageUsefulness: null,
      foundWhatNeededPercent: null,
      trustedResultsPercent: null,
      wouldUseAgainPercent: null,
    });
  });
});

describe("buildBetaFeedbackCsv", () => {
  test("exports included and excluded responses with their metric status and neutralises formulas", async () => {
    const reporting = await reportingModule();
    expect(reporting).not.toBeNull();

    const result = reporting!.buildBetaFeedbackCsv([
      feedback({ comments: '=HYPERLINK("https://example.test","click"), then review' }),
      feedback({ id: "feedback-2", comments: "testing", excludedAt: "2026-09-15T12:00:00.000Z", excludedBy: "admin@example.invalid" }),
    ]);

    expect(result).toBe([
      '"submitted_at","included_in_metrics","usefulness","found_what_needed","trusted_results","submitted_update","would_use_again","comments"',
      '"2026-09-14T12:00:00.000Z","yes","5","yes","yes","not_tried","yes","\'=HYPERLINK(""https://example.test"",""click""), then review"',
      '"2026-09-14T12:00:00.000Z","no","5","yes","yes","not_tried","yes","testing"',
    ].join("\r\n"));
    expect(result).not.toContain("admin@example.invalid");
    expect(result).not.toContain("feedback-1");
  });
});
