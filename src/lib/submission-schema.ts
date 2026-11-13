import { z } from "zod";
import { absorbencies, ukNations } from "@/types/location";

const shortText = (label: string, maximum: number) =>
  z.string().trim().min(2, `${label} is required.`).max(maximum, `${label} is too long.`);

export const reportKinds = ["new_location", "correction", "stock_update", "closure"] as const;

export const submissionSchema = z.object({
  reportKind: z.enum(reportKinds).default("new_location"),
  targetSlug: z.string().trim().max(100, "Location reference is too long.").default(""),
  place: shortText("Place name", 120),
  city: shortText("Town or city", 120),
  nation: z.enum(ukNations, { message: "Choose a UK nation." }),
  adminArea: z.string().trim().max(120, "Council area is too long.").default(""),
  postcode: z.string().trim().toUpperCase().min(5, "Enter a postcode.").max(10, "Postcode is too long."),
  products: shortText("Products seen", 300),
  absorbencies: z.array(z.enum(absorbencies)).max(absorbencies.length).default([]),
  brand: z.string().trim().max(120, "Brand is too long.").default(""),
  seenAt: z.string().trim().refine(
    (value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && value <= new Date().toISOString().slice(0, 10)),
    "Date seen cannot be in the future.",
  ).default(""),
  notes: z.string().trim().max(1_000, "Notes are too long.").default(""),
  website: z.string().max(0, "Automated submission rejected.").default(""),
}).superRefine((value, context) => {
  if (value.reportKind !== "new_location" && !value.targetSlug) {
    context.addIssue({ code: "custom", path: ["targetSlug"], message: "Choose the existing location this report is about." });
  }
});

export type NewSubmission = Omit<z.infer<typeof submissionSchema>, "website">;
