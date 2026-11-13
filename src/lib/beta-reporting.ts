import type { FeedbackRecord } from "@/lib/db";

export type BetaFeedbackSummary = {
  total: number;
  excluded: number;
  averageUsefulness: number | null;
  foundWhatNeededPercent: number | null;
  trustedResultsPercent: number | null;
  wouldUseAgainPercent: number | null;
};

function percentage(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : null;
}

export function summariseBetaFeedback(feedback: FeedbackRecord[]): BetaFeedbackSummary {
  const included = feedback.filter((item) => !item.excludedAt);
  const total = included.length;
  return {
    total,
    excluded: feedback.length - total,
    averageUsefulness: total ? Math.round((included.reduce((sum, item) => sum + item.usefulness, 0) / total) * 10) / 10 : null,
    foundWhatNeededPercent: percentage(included.filter((item) => item.foundWhatNeeded !== "no").length, total),
    trustedResultsPercent: percentage(included.filter((item) => item.trustedResults !== "no").length, total),
    wouldUseAgainPercent: percentage(included.filter((item) => item.wouldUseAgain !== "no").length, total),
  };
}

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[\t\r\n ]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildBetaFeedbackCsv(feedback: FeedbackRecord[]) {
  const rows: Array<Array<string | number>> = [
    ["submitted_at", "included_in_metrics", "usefulness", "found_what_needed", "trusted_results", "submitted_update", "would_use_again", "comments"],
    ...feedback.map((item) => [item.createdAt, item.excludedAt ? "no" : "yes", item.usefulness, item.foundWhatNeeded, item.trustedResults, item.submittedUpdate, item.wouldUseAgain, item.comments]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
