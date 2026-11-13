import type { Confidence } from "@/types/location";

const confidencePresentation: Record<Confidence, { shortLabel: string; explanation: string }> = {
  "venue-confirmed": {
    shortLabel: "Confirmed at this venue",
    explanation: "Official information names this venue and confirms the listed product details. Current stock can change.",
  },
  "scheme-confirmed": {
    shortLabel: "Covered by the local scheme",
    explanation: "Official information covers this venue category through the local scheme. Current stock and the exact brand can change.",
  },
  "community-reported": {
    shortLabel: "Reported by the community",
    explanation: "A visitor reported what they found and the report was reviewed before publication. Current stock can change.",
  },
};

export function getConfidencePresentation(confidence: Confidence): { shortLabel: string; explanation: string } {
  return confidencePresentation[confidence];
}
