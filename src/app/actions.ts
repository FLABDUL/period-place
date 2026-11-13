"use server";

import { createHash } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearAdminSession, createAdminSession, getCommunityIdentity, isAdminConfigured, requireAdmin, verifyPassword } from "@/lib/auth";
import { archiveLocation, consumeSubmissionRateLimit, createCheckIn, createContactRequest, createFeedback, createLocationRevision, createSubmission, moderateCheckIn, moderateSubmission, publishDraft, resolveContactRequest, restoreLocation, saveDraft, setFeedbackMetricInclusion } from "@/lib/db";
import { checkInSchema } from "@/lib/check-in-schema";
import { contactSchema } from "@/lib/contact-schema";
import { draftSchema } from "@/lib/draft-schema";
import { feedbackSchema } from "@/lib/feedback-schema";
import { submissionSchema } from "@/lib/submission-schema";
import type { ActionState } from "@/types/forms";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

async function anonymousRateLimitKey(scope: string) {
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || process.env.SESSION_SECRET || process.env.CLERK_SECRET_KEY || "period-place-development-only";
  return createHash("sha256").update(`${salt}:${scope}:${address}`).digest("hex");
}

export async function submitLocation(_: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    reportKind: String(formData.get("reportKind") || ""), targetSlug: String(formData.get("targetSlug") || ""),
    place: String(formData.get("place") || ""), city: String(formData.get("city") || ""), nation: String(formData.get("nation") || ""),
    adminArea: String(formData.get("adminArea") || ""), postcode: String(formData.get("postcode") || ""), products: formData.getAll("products").map(String), absorbencies: formData.getAll("absorbencies").map(String),
    brand: String(formData.get("brand") || ""), seenAt: String(formData.get("seenAt") || ""), notes: String(formData.get("notes") || ""),
  };
  const parsed = submissionSchema.safeParse({
    reportKind: formData.get("reportKind"),
    targetSlug: formData.get("targetSlug"),
    place: formData.get("place"),
    city: formData.get("city"),
    nation: formData.get("nation"),
    adminArea: formData.get("adminArea"),
    postcode: formData.get("postcode"),
    products: formData.getAll("products").map(String).join(", "),
    absorbencies: formData.getAll("absorbencies"),
    brand: formData.get("brand"),
    seenAt: formData.get("seenAt"),
    notes: formData.get("notes"),
    website: "",
  });
  if (!parsed.success) {
    return { success: false, message: "Please check the highlighted information.", errors: parsed.error.flatten().fieldErrors, values };
  }
  const { website: _honeypot, ...submission } = parsed.data;
  void _honeypot;
  const keyHash = await anonymousRateLimitKey("location-report");
  if (!(await consumeSubmissionRateLimit(keyHash))) {
    return { success: false, message: "Too many reports were sent from this connection. Please try again in an hour." };
  }
  await createSubmission(submission);
  revalidatePath("/admin");
  return { success: true, message: "Thank you. Your suggestion is waiting for review." };
}

export async function submitCheckIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const identity = await getCommunityIdentity();
  if (!identity) return { success: false, message: "Sign in before sharing a visit." };
  const parsed = checkInSchema.safeParse({
    locationSlug: formData.get("locationSlug"),
    availability: formData.get("availability"),
    observedAt: formData.get("observedAt"),
    accuracyRating: formData.get("accuracyRating"),
    accessRating: formData.get("accessRating"),
    privacyRating: formData.get("privacyRating"),
    comment: formData.get("comment"),
    website: formData.get("website"),
  });
  if (!parsed.success) return { success: false, message: "Please check the highlighted information.", errors: parsed.error.flatten().fieldErrors };
  if (!(await consumeSubmissionRateLimit(await anonymousRateLimitKey(`check-in:${identity.id}`), 10))) return { success: false, message: "Too many visits were submitted. Please try again in an hour." };
  const { website: _honeypot, ...checkIn } = parsed.data;
  void _honeypot;
  const result = await createCheckIn({ ...checkIn, userId: identity.id });
  if (result.status === "duplicate") return { success: false, message: "You have already reported this location for that date." };
  if (result.status === "not_found") return { success: false, message: "That public location could not be found." };
  revalidatePath(`/location/${checkIn.locationSlug}`);
  revalidatePath("/admin");
  return { success: true, message: "Thank you. Your visit is waiting for moderation." };
}

export async function submitFeedback(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = feedbackSchema.safeParse({ usefulness: formData.get("usefulness"), foundWhatNeeded: formData.get("foundWhatNeeded"), trustedResults: formData.get("trustedResults"), submittedUpdate: formData.get("submittedUpdate"), wouldUseAgain: formData.get("wouldUseAgain"), comments: formData.get("comments"), website: formData.get("website") });
  if (!parsed.success) return { success: false, message: "Please check the highlighted information.", errors: parsed.error.flatten().fieldErrors };
  if (!(await consumeSubmissionRateLimit(await anonymousRateLimitKey("beta-feedback"), 3))) return { success: false, message: "Too much feedback was sent from this connection. Please try again in an hour." };
  const { website: _honeypot, ...feedback } = parsed.data;
  void _honeypot;
  await createFeedback(feedback);
  revalidatePath("/admin");
  return { success: true, message: "Thank you. Your feedback has been saved privately." };
}

export async function submitContactRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse({ kind: formData.get("kind"), email: formData.get("email"), message: formData.get("message"), website: formData.get("website") });
  if (!parsed.success) return { success: false, message: "Please check the highlighted information.", errors: parsed.error.flatten().fieldErrors };
  if (!(await consumeSubmissionRateLimit(await anonymousRateLimitKey("contact-request"), 3))) return { success: false, message: "Too many requests were sent from this connection. Please try again in an hour." };
  const { website: _honeypot, ...request } = parsed.data;
  void _honeypot;
  await createContactRequest(request);
  revalidatePath("/admin");
  return { success: true, message: "Thank you. Your private request has been received." };
}

export async function loginAdmin(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isAdminConfigured()) return { success: false, message: "Admin access has not been configured yet." };
  const now = Date.now();
  const forwardedFor = (await headers()).get("x-forwarded-for");
  const key = forwardedFor?.split(",")[0]?.trim() || "local-admin";
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) {
    return { success: false, message: "Too many attempts. Try again in 15 minutes." };
  }
  const password = String(formData.get("password") || "");
  if (!verifyPassword(password)) {
    const next = attempt && attempt.resetAt > now ? { count: attempt.count + 1, resetAt: attempt.resetAt } : { count: 1, resetAt: now + 15 * 60 * 1000 };
    loginAttempts.set(key, next);
    return { success: false, message: "The password was not accepted." };
  }
  loginAttempts.delete(key);
  await createAdminSession();
  redirect("/admin");
}

export async function setSubmissionStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (status !== "approved" && status !== "rejected")) {
    throw new Error("Invalid moderation request.");
  }
  if (!(await moderateSubmission(id, status, admin))) throw new Error("Submission not found.");
  revalidatePath("/admin");
}

export async function setCheckInStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (status !== "approved" && status !== "rejected")) throw new Error("Invalid check-in moderation request.");
  if (!(await moderateCheckIn(id, status, admin))) throw new Error("Check-in not found.");
  revalidateTag("public-locations", { expire: 0 });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function setContactRequestStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await resolveContactRequest(id, admin))) throw new Error("Contact request could not be resolved.");
  revalidatePath("/admin");
}

export async function setFeedbackMetricsStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const intent = String(formData.get("intent") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (intent !== "include" && intent !== "exclude")) throw new Error("Invalid feedback moderation request.");
  if (!(await setFeedbackMetricInclusion(id, intent === "include", admin))) throw new Error("Feedback metric status was unchanged.");
  revalidatePath("/admin");
}

export async function saveLocationDraft(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const parsed = draftSchema.safeParse({
    id,
    name: formData.get("name"),
    city: formData.get("city"),
    nation: formData.get("nation"),
    adminArea: formData.get("adminArea"),
    venueType: formData.get("venueType"),
    address: formData.get("address"),
    postcode: formData.get("postcode"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    access: formData.get("access"),
    productTypes: formData.getAll("productTypes"),
    brand: formData.get("brand"),
    attributes: formData.getAll("attributes"),
    absorbencies: formData.getAll("absorbencies"),
    evidence: formData.get("evidence"),
    lastVerifiedAt: formData.get("lastVerifiedAt"),
  });
  if (!parsed.success) redirect(`/admin/drafts/${id}?error=validation`);
  if (!(await saveDraft(parsed.data, admin))) throw new Error("Draft could not be updated.");
  revalidatePath("/admin");
  redirect(`/admin/drafts/${id}?saved=1`);
}

export async function publishLocationDraft(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid draft.");
  const slug = await publishDraft(id, admin);
  if (!slug) redirect(`/admin/drafts/${id}?error=not-ready`);
  revalidateTag("public-locations", { expire: 0 });
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/location/${slug}`);
  redirect(`/admin/drafts/${id}?published=1`);
}

export async function startLocationRevision(formData: FormData) {
  const admin = await requireAdmin();
  const id=String(formData.get("id")||"");
  if(!/^[0-9a-f-]{36}$/i.test(id)||!(await createLocationRevision(id,admin)))throw new Error("A revision could not be created.");
  redirect(`/admin/drafts/${id}`);
}

export async function setLocationVisibility(formData: FormData) {
  const admin = await requireAdmin();
  const id=String(formData.get("id")||"");
  const intent=String(formData.get("intent")||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Invalid location.");
  const changed=intent==="archive"?await archiveLocation(id,admin):intent==="restore"?await restoreLocation(id,admin):false;
  if(!changed)throw new Error("Location visibility could not be changed.");
  revalidateTag("public-locations", { expire: 0 });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function logoutAdmin() {
  await requireAdmin();
  await clearAdminSession();
  redirect("/admin/login");
}
