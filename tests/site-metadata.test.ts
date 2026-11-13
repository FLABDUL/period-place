import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { createPageMetadata } from "@/lib/site-metadata";

describe("search metadata", () => {
  it("generates canonical and social metadata from one route definition", () => {
    const metadata = createPageMetadata({
      title: "Suggest a location",
      description: "Suggest a location for review.",
      path: "/contribute",
    });

    expect(metadata).toMatchObject({
      title: "Suggest a location",
      description: "Suggest a location for review.",
      alternates: { canonical: "/contribute" },
      openGraph: {
        type: "website",
        siteName: "Period Place",
        title: "Suggest a location · Period Place",
        description: "Suggest a location for review.",
        url: "/contribute",
        images: [{ url: "/period-place-share-card.png", width: 1200, height: 630, alt: "Period Place — find free period products near you" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Suggest a location · Period Place",
        description: "Suggest a location for review.",
        images: [{ url: "/period-place-share-card.png", width: 1200, height: 630, alt: "Period Place — find free period products near you" }],
      },
    });
  });

  it("publishes crawler rules without exposing private application routes", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/sign-in"],
      },
      sitemap: "https://periodplace.org/sitemap.xml",
      host: "https://periodplace.org",
    });
  });

  it("lists stable public pages without private application routes", () => {
    const entries = sitemap();

    expect(entries).toContainEqual({ url: "https://periodplace.org", changeFrequency: "weekly", priority: 1 });
    expect(entries).toContainEqual({ url: "https://periodplace.org/contribute", changeFrequency: "monthly", priority: 0.7 });
    expect(entries.some(({ url }) => url.includes("/admin") || url.includes("/sign-in") || url.includes("/api/"))).toBe(false);
    expect(entries).toHaveLength(9);
  });
});
