import { z } from "zod";

export const availabilityStatuses = ["available", "low_stock", "out_of_stock", "could_not_find", "location_unavailable"] as const;

const optionalRating = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().int().min(1).max(5).optional(),
);

export const checkInSchema = z.object({
  locationSlug: z.string().trim().min(1).max(100),
  availability: z.enum(availabilityStatuses),
  observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Add the date you visited.").refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    "The visit date cannot be in the future.",
  ),
  accuracyRating: optionalRating,
  accessRating: optionalRating,
  privacyRating: optionalRating,
  comment: z.string().trim().max(500, "Comment must be 500 characters or fewer.").default(""),
  website: z.string().max(0, "Automated submission rejected.").default(""),
});

export type NewCheckIn = Omit<z.infer<typeof checkInSchema>, "website"> & { userId: string };
