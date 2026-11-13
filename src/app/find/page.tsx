import type { Metadata } from "next";
import { FinderApp } from "@/components/finder-app";
import { getLocationFacets, searchLocations } from "@/lib/location-search";
import { getPublicLocations } from "@/lib/public-locations";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({ title: "Find free period products", description: "Search evidence-backed free period product locations across the UK.", path: "/find" });
export const dynamic = "force-dynamic";

export default async function FindPage() {
  const locations = await getPublicLocations();
  return <>
    <section className="finder-intro"><p className="eyebrow">Free period products across the UK</p><h1>Find products near you.</h1><p>Search every published location, then check official information and recent visitor reports before travelling.</p></section>
    <FinderApp initialResult={searchLocations(locations)} facets={getLocationFacets(locations)} />
  </>;
}
