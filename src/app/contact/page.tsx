import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { contactKinds } from "@/lib/contact-schema";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({ title: "Contact", description: "Contact Period Place privately about the service, responsible sponsorship or a privacy and deletion request.", path: "/contact" });

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const params = await searchParams;
  const requestedKind = typeof params.kind === "string" ? params.kind : "";
  const initialKind = contactKinds.find((kind) => kind === requestedKind) || "general";
  return <div className="page-shell narrow-page"><p className="eyebrow">Private contact</p><h1>Contact Period Place.</h1><p>Use this form for project questions, responsible sponsorship proposals or requests concerning your personal information. Messages are not published.</p><ContactForm initialKind={initialKind} /></div>;
}
