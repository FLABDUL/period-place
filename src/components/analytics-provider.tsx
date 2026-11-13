"use client";

import { Analytics } from "@vercel/analytics/next";
import { sanitiseAnalyticsEvent } from "@/lib/analytics";

export function AnalyticsProvider() {
  return <Analytics beforeSend={sanitiseAnalyticsEvent} />;
}
