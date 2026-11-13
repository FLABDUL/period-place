"use client";

import { useEffect } from "react";
import { analyticsEvents } from "@/lib/analytics";

export function LocationOpenTracker() {
  useEffect(() => analyticsEvents.locationOpen(), []);
  return null;
}
