"use client";

import { analyticsEvents } from "@/lib/analytics";

export function SupportOutboundLink({ href }: { href: string }) {
  return <a className="primary-button inline-button" href={href} target="_blank" rel="noreferrer" onClick={() => analyticsEvents.supportOutbound()}>Support Period Place ↗</a>;
}
