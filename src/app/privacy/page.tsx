import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({ title: "Privacy", description: "Learn what Period Place collects, how service analytics work and how to request access, correction or deletion.", path: "/privacy" });

export default function PrivacyPage() {
  return <div className="page-shell narrow-page">
    <p className="eyebrow">Privacy</p>
    <h1>Collect only what the map needs.</h1>
    <div className="panel">
      <h2>Public reports</h2>
      <p>The suggestion form stores the place details, products, brand, date and notes you submit. Private feedback stores your rating, answer and comments. These forms do not ask for your name, email address or an account.</p>
      <p>To slow automated abuse, Period Place turns the requesting network address into a salted one-way hash. The raw address is not stored by the app. Expired rate-limit records are removed during later submission activity.</p>
    </div>
    <div className="panel">
      <h2>Community visits</h2>
      <p>Sharing a visit requires a Clerk account. Period Place stores the account identifier to limit duplicate reports, together with the location, visit date, availability choice, optional ratings and optional comment. Your account identifier, name and email address are not displayed with an approved public visit.</p>
      <p>Every visit is moderated before publication. Do not include names, contact details, health information or information about another person in a comment.</p>
    </div>
    <div className="panel">
      <h2>Anonymous service analytics</h2>
      <p>Period Place uses Vercel Web Analytics to understand aggregate page use and whether core tasks work. It records anonymous page views and six service events: searches, searches with no results, location details opened, reports submitted, feedback submitted and outbound support links used.</p>
      <p>Analytics does not receive search terms, postcodes, precise location, form answers, comments, account identifiers or other information you enter. Event properties are limited to fixed search modes and broad result-count bands. Only validated categorical campaign labels from the five standard UTM fields are retained from query strings; every other query parameter and all page fragments are removed, and administration and sign-in pages are excluded.</p>
      <p>Vercel does not use cookies for Web Analytics. Analytics records may include the time, page path, referrer, approximate location derived from the request, browser, operating system and device type. Vercel uses a request-derived hash for anonymous visitor counting and discards that visitor session after 24 hours.</p>
    </div>
    <div className="panel">
      <h2>Administration and retention</h2>
      <p>Approved administrators sign in through Clerk. Their account identifier and email label are recorded beside moderation and publication actions so changes are accountable.</p>
      <p>Rejected reports and private feedback are retained for up to 12 months. Contact requests are retained for up to 12 months after resolution. Published evidence, its revision history and moderation audit records are retained while the location remains on the map, then reviewed for deletion or anonymisation within 24 months of archival.</p>
      <p>Rate-limit hashes expire automatically through later submission activity. Account-linked community visits remain while they support the public record unless deletion is requested.</p>
    </div>
    <div className="panel"><h2>Your privacy choices</h2><p>You may ask what personal information is associated with your account, request correction, or request deletion. Identity must be verified before account-linked information is disclosed or removed.</p><Link className="primary-button inline-button" href="/contact?kind=privacy_deletion">Make a private privacy or deletion request</Link></div>
    <p>This is an early-stage service, not an emergency or medical service. Avoid including personal or sensitive information in a public report.</p>
  </div>;
}
