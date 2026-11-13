import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getConfidencePresentation } from "@/lib/evidence-presentation";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata:Metadata=createPageMetadata({title:"About Period Place",description:"Learn how Period Place handles evidence, community visits and UK coverage for free period product locations.",path:"/about"});

export default function AboutPage(){return <div className="page-shell">
  <p className="eyebrow">About Period Place</p><h1>Useful data without false certainty.</h1>
  <p>Period Place helps people find free period products by the details that affect their choice: product type, brand, materials, access and how recently somebody found stock.</p>
  <div className="panel"><h2>What the evidence labels mean</h2><ul className="source-list">
    <li><strong>{getConfidencePresentation("venue-confirmed").shortLabel}</strong><small>{getConfidencePresentation("venue-confirmed").explanation} For example, a library lists the pads it provides.</small></li>
    <li><strong>{getConfidencePresentation("scheme-confirmed").shortLabel}</strong><small>{getConfidencePresentation("scheme-confirmed").explanation} For example, a council includes public libraries in its scheme.</small></li>
    <li><strong>{getConfidencePresentation("community-reported").shortLabel}</strong><small>{getConfidencePresentation("community-reported").explanation} For example, a visitor reports finding tampons at a community centre.</small></li>
  </ul></div>
  <div className="panel"><h2>Community visits</h2><p>A required structured status—such as available, low stock or empty—makes reports comparable. Ratings and comments are optional. Accounts help prevent duplicate reports, but community identities are not displayed publicly.</p></div>
  <div className="panel"><h2>UK coverage</h2><p>The platform accepts locations throughout England, Scotland, Wales and Northern Ireland. Coverage now includes evidence-backed libraries in Scotland and Northern Ireland, plus NHS patient access points and selected libraries in England. Wales remains a visible data gap, with the official Welsh Government map linked as an alternative. See the live <Link href="/coverage">coverage and source breakdown</Link>.</p></div>
  <div className="panel creator-panel"><Image className="creator-photo" src="/hakim-profile.jpg" alt="Hakim, creator of Period Place" width={220} height={220} /><div><p className="eyebrow">About the creator</p><h2>Built by Hakim.</h2><p>Hakim created Period Place after discovering how difficult it could be to identify the exact free product available before travelling.</p><a className="primary-button inline-button" href="https://madebyhakim.com/" target="_blank" rel="noreferrer">Visit Made by Hakim ↗</a></div></div>
</div>}
