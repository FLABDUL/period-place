import { describe, expect, it } from "vitest";
import { draftSchema } from "@/lib/draft-schema";
import { feedbackSchema } from "@/lib/feedback-schema";
import { submissionSchema } from "@/lib/submission-schema";
import { checkInSchema } from "@/lib/check-in-schema";
import { contactSchema } from "@/lib/contact-schema";

describe("submission validation", () => {
  const valid = {
    reportKind: "new_location",
    targetSlug: "",
    place: "Test Library",
    city: "Glasgow",
    nation: "Scotland",
    adminArea: "Glasgow City",
    postcode: "G1 1AA",
    products: "Pads",
    absorbencies: ["Light", "Heavy"],
    brand: "Unknown",
    seenAt: "2026-08-30",
    notes: "Test report",
    website: "",
  };

  it("accepts a complete report", () => {
    expect(submissionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unsupported absorbency descriptions", () => {
    expect(submissionSchema.safeParse({ ...valid, absorbencies: ["Maximum"] }).success).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    expect(submissionSchema.safeParse({ ...valid, website: "https://spam.invalid" }).success).toBe(false);
  });

  it("rejects a future observation date", () => {
    expect(submissionSchema.safeParse({ ...valid, seenAt: "2999-01-01" }).success).toBe(false);
  });

  it("requires an existing location for a correction", () => {
    const result = submissionSchema.safeParse({ ...valid, reportKind: "correction" });
    expect(result.success).toBe(false);
  });

  it("accepts a new location anywhere in the UK", () => {
    expect(submissionSchema.safeParse({ ...valid, city: "Bristol", nation: "England", adminArea: "Bristol City" }).success).toBe(true);
  });
});

describe("community visit validation", () => {
  it("requires a structured availability status but keeps ratings and comments optional", () => {
    expect(checkInSchema.safeParse({ locationSlug: "leith-library", availability: "available", observedAt: "2026-08-30", accuracyRating: "", accessRating: "", privacyRating: "", comment: "", website: "" }).success).toBe(true);
    expect(checkInSchema.safeParse({ locationSlug: "leith-library", availability: "maybe", observedAt: "2026-08-30", website: "" }).success).toBe(false);
  });
});

describe("draft validation", () => {
  it("requires coordinates, evidence and at least one product", () => {
    const result = draftSchema.safeParse({
      id: crypto.randomUUID(),
      name: "Test Library",
      city: "Glasgow",
      nation: "Scotland",
      adminArea: "Glasgow City",
      venueType: "Library",
      address: "1 Test Street",
      postcode: "G1 1AA",
      latitude: "55.86",
      longitude: "-4.25",
      access: "Free self-service products",
      productTypes: [],
      brand: "",
      attributes: [],
      absorbencies: ["Regular"],
      evidence: "short",
      lastVerifiedAt: "2026-08-30",
    });
    expect(result.success).toBe(false);
  });
});

describe("feedback validation", () => {
  it("accepts useful anonymous beta feedback", () => {
    expect(feedbackSchema.safeParse({ usefulness: "4", foundWhatNeeded: "partly", trustedResults: "yes", submittedUpdate: "not_tried", wouldUseAgain: "yes", comments: "More exact brand details would help.", website: "" }).success).toBe(true);
  });

  it("rejects feedback outside the rating scale", () => {
    expect(feedbackSchema.safeParse({ usefulness: "8", foundWhatNeeded: "yes", trustedResults: "yes", submittedUpdate: "yes", wouldUseAgain: "yes", comments: "This should not pass.", website: "" }).success).toBe(false);
  });
});

describe("contact validation", () => {
  it("accepts a private privacy request and rejects invalid contact details", () => {
    expect(contactSchema.safeParse({ kind: "privacy_deletion", email: "person@example.com", message: "Please delete my account-linked visits.", website: "" }).success).toBe(true);
    expect(contactSchema.safeParse({ kind: "sponsorship", email: "not-an-email", message: "Short", website: "" }).success).toBe(false);
  });
});
