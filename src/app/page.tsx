import type { Metadata } from "next";
import Link from "next/link";
import { summariseCoverage } from "@/lib/coverage";
import { getPublicLocations } from "@/lib/public-locations";
import { createPageMetadata, siteDescription, siteName } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({ title: siteName, description: siteDescription, path: "/" });

export const dynamic = "force-dynamic";

export default async function Home() {
  const coverage = summariseCoverage(await getPublicLocations());

  return <>
    <section className="hero landing-hero">
      <div className="hero-copy">
        <p className="eyebrow">Free products · community knowledge</p>
        <h1>Find free period products near you</h1>
        <p className="hero-intro">Search free period products across the UK, check official information, and see recent visitor reports before you travel.</p>
        <p className="hero-caveat">Exact products and stock can change. Period Place shows uncertainty instead of guessing.</p>
        <div className="hero-actions"><Link className="primary-button" href="/find">Find free products</Link><Link className="text-link" href="/contribute">Report what you found →</Link></div>
      </div>
      <aside className="proof-card"><p className="proof-kicker">Built around real needs</p><p className="proof-brand">Free products. Clear evidence.</p><p>Official information shows where schemes provide products. Recent visitor reports help you know what to expect between updates.</p><div className="proof-rule" /><p><strong>Specific when we can be.</strong><br />Brands and product details appear only when evidence supports them.</p></aside>
    </section>
    <section className="trust-strip" aria-label="Current data coverage"><p><span>{coverage.total}</span><strong>Published locations</strong><small>Every pin has traceable evidence</small></p><p><span>{coverage.coveredNations}/4</span><strong>UK nations represented</strong><small>Known gaps are shown openly</small></p><p><span>{coverage.withNamedBrand}</span><strong>With a named brand</strong><small>Unknown details remain unknown</small></p></section>
    <section className="landing-steps" aria-labelledby="how-it-works"><p className="eyebrow">How it works</p><h2 id="how-it-works">Useful before you set off.</h2><div className="step-grid"><article><span>1</span><h3>Search</h3><p>Use a place, postcode, product type, brand or material preference.</p></article><article><span>2</span><h3>Check the evidence</h3><p>Check official information and recent visitor reports for the listing.</p></article><article><span>3</span><h3>Help the next person</h3><p>Share a stock update or correction for moderation after your visit.</p></article></div></section>
    <section className="landing-coverage"><div><p className="eyebrow">Growing UK coverage</p><h2>See where the map has weight.</h2><p>Coverage is expanding, but a blank area means we have not added reliable data yet—not that free products are unavailable.</p></div><div className="hero-actions"><Link className="primary-button" href="/find">Open the finder</Link><Link className="text-link" href="/coverage">View coverage and sources →</Link></div></section>
  </>;
}
