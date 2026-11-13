import { z } from "zod";
import { absorbencies, productAttributes, productTypes, ukNations } from "@/types/location";

const venueTypes = ["Library", "Community centre", "Public venue", "School or college", "Health venue", "Food bank", "Workplace", "Other"] as const;
const confidenceLevels = ["venue-confirmed", "scheme-confirmed", "community-reported"] as const;

const sourceSchema = z.object({
  label: z.string().trim().min(2),
  url: z.url().refine((url) => url.startsWith("https://"), "Sources must use HTTPS."),
  checked: z.string().trim().min(4),
  scope: z.string().trim().min(10),
});

const productSchema = z.object({
  type: z.enum(productTypes),
  brand: z.string().trim().min(1).nullable(),
  attributes: z.array(z.enum(productAttributes)),
  absorbencies: z.array(z.enum(absorbencies)).optional(),
  evidence: z.string().trim().min(10),
});

export type SourcePackStatus = "cleared" | "preview-only" | "blocked";

export const sourcePackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(5),
  checkedAt: z.iso.date(),
  checked: z.string().trim().min(4),
  productionStatus: z.enum(["cleared", "preview-only", "blocked"]),
  licenceReview: z.string().trim().min(20),
  attribution: z.string().trim().min(10),
  primarySources: z.array(sourceSchema).min(2),
  locations: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(2),
    city: z.string().trim().min(2),
    nation: z.enum(ukNations),
    adminArea: z.string().trim().min(2),
    venueType: z.enum(venueTypes),
    address: z.string().trim().min(2),
    postcode: z.string().trim().regex(/^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/),
    latitude: z.number().min(49).max(61),
    longitude: z.number().min(-8.7).max(2.1),
    access: z.string().trim().min(10),
    confidence: z.enum(confidenceLevels),
    products: z.array(productSchema).min(1),
    sources: z.array(sourceSchema).min(2),
  })).min(1),
}).superRefine((pack, context) => {
  const slugs = new Set<string>();
  const postcodes = new Set<string>();
  for (const [index, location] of pack.locations.entries()) {
    if (slugs.has(location.slug)) context.addIssue({ code: "custom", path: ["locations", index, "slug"], message: "Duplicate slug." });
    if (postcodes.has(location.postcode)) context.addIssue({ code: "custom", path: ["locations", index, "postcode"], message: "Duplicate postcode." });
    slugs.add(location.slug);
    postcodes.add(location.postcode);
  }
});

export type SourcePack = z.infer<typeof sourcePackSchema>;
