import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { hasAdminSession, isAdminConfigured, usesClerkAuth } from "@/lib/auth";

export const metadata:Metadata={title:"Admin sign in"};
export default async function AdminLoginPage(){
  if(await hasAdminSession()) redirect("/admin");
  const configured=isAdminConfigured();
  return <div className="page-shell narrow-page"><p className="eyebrow">Protected administration</p><h1>Sign in to review.</h1><p>The public can suggest corrections, but only an authorised reviewer can change their status.</p>{usesClerkAuth()?configured?<div className="clerk-sign-in"><SignIn routing="hash" fallbackRedirectUrl="/admin" /></div>:<p className="action-message error">Clerk is connected, but no administrator email address or user ID has been allowlisted.</p>:<LoginForm configured={configured} />}</div>
}
