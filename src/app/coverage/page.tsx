import type { Metadata } from "next";
import Link from "next/link";
import { CoverageBrowser } from "@/components/coverage-browser";
import { activeSourcePacks } from "@/data/source-packs";
import { summariseCoverage } from "@/lib/coverage";
import { getPublicLocations } from "@/lib/public-locations";
import { createPageMetadata } from "@/lib/site-metadata";
import { ukNations } from "@/types/location";

export const metadata: Metadata = createPageMetadata({ title: "Coverage and sources", description: "See exactly where Period Place has evidence-backed free period product locations and where data is still missing.", path: "/coverage" });
export const dynamic = "force-dynamic";

export default async function CoveragePage() {
  const locations = await getPublicLocations();
  const summary = summariseCoverage(locations);
  const covered = new Set(locations.map((location) => location.nation));

  return <div className="page-shell coverage-page">
    <p className="eyebrow">Transparent UK coverage</p>
    <h1>Where the map has weight—and where it does not.</h1>
    <p>Every pin needs a named venue and traceable evidence. A blank area means we have not added reliable data yet; it does not mean free products are unavailable there.</p>

    <section className="coverage-stats" aria-label="Current coverage summary">
      <p><strong>{summary.total}</strong><span>published locations</span></p>
      <p><strong>{summary.coveredNations}/4</strong><span>UK nations represented</span></p>
      <p><strong>{summary.coverageAreas}</strong><span>coverage areas</span></p>
      <p><strong>{summary.withNamedBrand}</strong><span>locations with a named brand</span></p>
    </section>

    <section className="panel">
      <h2>Coverage by nation</h2>
      <div className="nation-grid">{ukNations.map((nation) => {
        const count = locations.filter((location) => location.nation === nation).length;
        return <p key={nation} className={covered.has(nation) ? "covered" : "gap"}><strong>{nation}</strong><span>{count ? `${count} locations` : "No verified locations yet"}</span></p>;
      })}</div>
      {!covered.has("Wales") && <p className="coverage-fallback">Period Place does not yet publish verified Welsh locations. You can still find provision on the <a className="text-link" href="https://datamap.gov.wales/maps/map-to-free-period-products/" target="_blank" rel="noreferrer">official Welsh Government map ↗</a>.</p>}
    </section>

    <section className="panel">
      <h2>Coverage by area</h2>
      <p>Search directly or open a nation to scan its council and service areas.</p>
      <CoverageBrowser areas={summary.areas} />
    </section>

    <section className="panel">
      <h2>How the national foundation was built</h2>
      <p>The first expansion uses official library and government data. Product details remain marked unknown when a source confirms provision but does not identify the type or brand. Only source packs cleared for reuse can appear in production.</p>
      <ul className="source-list">{activeSourcePacks.map((pack) => <li key={pack.id}><strong>{pack.title}</strong><small>{pack.locations.length} locations · checked {new Date(pack.checkedAt).toLocaleDateString("en-GB")} · {pack.productionStatus === "cleared" ? "cleared for production" : "preview only"}</small><p>{pack.licenceReview}</p><p><small>{pack.attribution}</small></p><div className="source-links">{pack.primarySources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div></li>)}</ul>
      <p><Link className="text-link" href="/contribute">Know a missing venue? Suggest it for review →</Link></p>
    </section>
  </div>;
}
