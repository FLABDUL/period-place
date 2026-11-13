import { z } from "zod";
import { absorbencies, productAttributes, productTypes, ukNations } from "@/types/location";

export { absorbencies, productAttributes, productTypes };
export const venueTypes = ["Library", "Community centre", "Public venue", "School or college", "Health venue", "Food bank", "Workplace", "Other"] as const;

export const draftSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2, "Name is required.").max(120),
  city: z.string().trim().min(2, "Town or city is required.").max(120),
  nation: z.enum(ukNations),
  adminArea: z.string().trim().max(120).default(""),
  venueType: z.enum(venueTypes),
  address: z.string().trim().min(2, "Address is required.").max(200),
  postcode: z.string().trim().toUpperCase().min(5, "Postcode is required.").max(10),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  access: z.string().trim().min(2, "Access information is required.").max(300),
  productTypes: z.array(z.enum(productTypes)).min(1, "Choose at least one product."),
  brand: z.string().trim().max(120).default(""),
  attributes: z.array(z.enum(productAttributes)).default([]),
  absorbencies: z.array(z.enum(absorbencies)).max(absorbencies.length).default([]),
  evidence: z.string().trim().min(10, "Add a short evidence note.").max(500),
  lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Add a verification date."),
});

export type DraftInput = z.infer<typeof draftSchema>;
