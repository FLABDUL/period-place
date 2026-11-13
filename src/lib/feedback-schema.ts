import { z } from "zod";

export const feedbackSchema = z.object({
  usefulness: z.coerce.number().int().min(1, "Choose a rating.").max(5, "Choose a rating."),
  foundWhatNeeded: z.enum(["yes", "partly", "no"], { message: "Choose an answer." }),
  trustedResults: z.enum(["yes", "partly", "no"], { message: "Choose an answer." }),
  submittedUpdate: z.enum(["yes", "no", "not_tried"], { message: "Choose an answer." }),
  wouldUseAgain: z.enum(["yes", "maybe", "no"], { message: "Choose an answer." }),
  comments: z.string().trim().min(5, "Please add a little more detail.").max(1_000, "Feedback is too long."),
  website: z.string().max(0, "Automated submission rejected.").default(""),
});

export type NewFeedback = Omit<z.infer<typeof feedbackSchema>, "website">;
