import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { usesClerkAuth } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in/[[...sign-in]]">) {
  if (!usesClerkAuth()) redirect("/");
  const query = await searchParams;
  const requested = typeof query.redirect_url === "string" ? query.redirect_url : "/";
  const destination = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return <div className="page-shell auth-page"><p className="eyebrow">Community account</p><h1>Sign in to share a visit.</h1><p>Your identity is used to prevent duplicate reports and is never shown with a public comment.</p><SignIn routing="path" path="/sign-in" forceRedirectUrl={destination}/></div>;
}
