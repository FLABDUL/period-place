import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "period-place-admin";
const sessionDuration = 60 * 60 * 8;

export type AdminIdentity = { id: string; label: string };
export type CommunityIdentity = { id: string };

function configuredSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

function configuredPassword() {
  const password = process.env.ADMIN_PASSWORD;
  return password && password.length >= 12 ? password : null;
}

function equalSecret(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function isAdminConfigured() {
  if (usesClerkAuth()) return allowedClerkUserIds().length > 0 || allowedAdminEmails().length > 0;
  return Boolean(configuredSecret() && configuredPassword());
}

export function usesClerkAuth() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

function allowedClerkUserIds() {
  return (process.env.ADMIN_CLERK_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function allowedAdminEmails() {
  return (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
}

export function verifyPassword(candidate: string) {
  const password = configuredPassword();
  return password ? equalSecret(candidate, password) : false;
}

export async function createAdminSession() {
  const secret = configuredSecret();
  if (!secret) throw new Error("Admin session secret is not configured.");
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDuration;
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDuration,
  });
}

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (usesClerkAuth()) {
    const { userId } = await clerkAuth();
    if (!userId) return null;
    const user = await currentUser();
    const primaryEmail = user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress
      || user?.emailAddresses[0]?.emailAddress;
    if (allowedClerkUserIds().includes(userId)) return { id: userId, label: primaryEmail || userId };
    const emails = allowedAdminEmails();
    const allowedEmail = user?.emailAddresses.find((email) => emails.includes(email.emailAddress.toLowerCase()))?.emailAddress;
    return allowedEmail ? { id: userId, label: allowedEmail } : null;
  }
  const secret = configuredSecret();
  const token = (await cookies()).get(cookieName)?.value;
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload.role === "admin" ? { id: "local-admin", label: "Local administrator" } : null;
  } catch {
    return null;
  }
}

export async function hasAdminSession() {
  return Boolean(await getAdminIdentity());
}

export async function getCommunityIdentity(): Promise<CommunityIdentity | null> {
  if (!usesClerkAuth()) return null;
  const { userId } = await clerkAuth();
  return userId ? { id: userId } : null;
}

export async function requireAdmin() {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  return identity;
}

export async function clearAdminSession() {
  if (usesClerkAuth()) return;
  (await cookies()).delete(cookieName);
}
