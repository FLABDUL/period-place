import { z } from "zod";

export const contactKinds = ["general", "sponsorship", "privacy_deletion"] as const;
export const contactSchema = z.object({
  kind: z.enum(contactKinds, { message: "Choose a request type." }),
  email: z.string().trim().email("Enter a valid email address.").max(254, "Email address is too long."),
  message: z.string().trim().min(10, "Please add a little more detail.").max(2_000, "Message is too long."),
  website: z.string().max(0, "Automated submission rejected.").default(""),
});

export type NewContactRequest = Omit<z.infer<typeof contactSchema>, "website">;
