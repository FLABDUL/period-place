import { describe, expect, it } from "vitest";
import { getConfidencePresentation } from "@/lib/evidence-presentation";

describe("public evidence presentation", () => {
  it("describes information confirmed at the individual venue", () => {
    expect(getConfidencePresentation("venue-confirmed")).toEqual({
      shortLabel: "Confirmed at this venue",
      explanation: "Official information names this venue and confirms the listed product details. Current stock can change.",
    });
  });

  it("explains category coverage without promising current stock or an exact brand", () => {
    expect(getConfidencePresentation("scheme-confirmed")).toEqual({
      shortLabel: "Covered by the local scheme",
      explanation: "Official information covers this venue category through the local scheme. Current stock and the exact brand can change.",
    });
  });

  it("distinguishes a reviewed visitor report from official information", () => {
    expect(getConfidencePresentation("community-reported")).toEqual({
      shortLabel: "Reported by the community",
      explanation: "A visitor reported what they found and the report was reviewed before publication. Current stock can change.",
    });
  });
});
