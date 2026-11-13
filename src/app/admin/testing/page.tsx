import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Manual test guide" };

const cases = [
  ["Finder start-up", "Open the homepage without a saved search.", "The page says no filters are selected, every published location appears as a map pin, and location cards load in batches."],
  ["Nearest postcode", "Search for G4 9LJ.", "The finder explains it is showing locations within 25 km and The Mitchell Library appears near the top."],
  ["Text search", "Clear the search, then search for Leith Library.", "Only matching location evidence is shown and Clear all reports one active selection."],
  ["Filters", "Try every visible product, brand and preference filter one at a time.", "Every visible choice returns at least one location. Choices with no supporting evidence are not offered."],
  ["Invalid location report", "Open Report a change, choose a new location, enter a place and submit without the other required information.", "A visible summary names each problem, the entries already typed remain in the form, and focus moves to the summary."],
  ["Moderated location report", "Submit a clearly labelled BETA TEST report, then return to Admin.", "It appears under Incoming reports and nowhere publicly. Reject it after checking the controls."],
  ["Moderated visit", "While signed in, submit a visit from a location page using a clearly labelled test comment.", "It appears under Community visit moderation and remains private until approved. Reject the test record afterwards."],
  ["Private feedback", "Complete the feedback form.", "A success message appears and the response is visible only under Private user feedback in Admin."],
  ["Mobile and keyboard", "Repeat finder search and report validation at a narrow width, then navigate using Tab and Enter only.", "The menu, controls, messages and focus indicator remain visible and usable without horizontal scrolling."],
] as const;

export default async function AdminTestingPage() {
  await requireAdmin();
  return <main className="page-shell">
    <p><Link className="text-link" href="/admin">← Back to administration</Link></p>
    <p className="eyebrow">Reusable pre-release checks</p>
    <h1>Manual test guide.</h1>
    <p>Run these cases before inviting a new beta cohort and after any finder, form, authentication or moderation change. Use genuine observations where possible; reject records explicitly labelled as tests.</p>
    <ol className="manual-test-list">{cases.map(([name, action, expected], index)=><li className="panel" key={name}><p className="eyebrow">Test {index + 1}</p><h2>{name}</h2><p><strong>Action:</strong> {action}</p><p><strong>Expected:</strong> {expected}</p></li>)}</ol>
  </main>;
}
