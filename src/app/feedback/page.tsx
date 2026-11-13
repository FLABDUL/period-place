import type { Metadata } from "next";
import { FeedbackForm } from "@/components/feedback-form";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({ title: "Give feedback", description: "Share private feedback about whether Period Place was useful, trustworthy and easy to use.", path: "/feedback" });

export default function FeedbackPage() {
  return <div className="page-shell narrow-page"><p className="eyebrow">Private feedback</p><h1>Feedback about Period Place</h1><p>Tell us whether Period Place helped, whether you trusted the information and what got in the way. Feedback is private and reviewed by the Period Place administrator.</p><FeedbackForm /></div>;
}
