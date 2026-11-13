"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { analyticsEvents, scheduleFinderSearch, type FinderSearchMode } from "@/lib/analytics";
import { finderPageSize, type LocationFacets, type LocationSearchResult } from "@/lib/location-search";
import { getConfidencePresentation } from "@/lib/evidence-presentation";
import type { Absorbency, AvailabilityStatus } from "@/types/location";

const MapPanel = dynamic(() => import("@/components/map-panel").then((module) => module.MapPanel), {
  ssr: false,
  loading: () => <div className="map map-loading">Loading map…</div>,
});

const availabilityLabels: Record<AvailabilityStatus, string> = {
  available: "Recently available", low_stock: "Recently low stock", out_of_stock: "Recently empty", could_not_find: "Could not be found", location_unavailable: "Location unavailable",
};

function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function FilterGroup({ label, values, selected, onToggle }: { label: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  if (!values.length) return null;
  return <fieldset className="facet-group"><legend>{label}</legend><div className="filter-row">{values.map((value) => <button aria-pressed={selected.includes(value)} className={selected.includes(value) ? "filter active" : "filter"} type="button" key={value} onClick={() => onToggle(value)}>{value}</button>)}</div></fieldset>;
}

export function FinderApp({ initialResult, facets }: { initialResult: LocationSearchResult; facets: LocationFacets }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [types, setTypes] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<string[]>([]);
  const [absorbencies, setAbsorbencies] = useState<Absorbency[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [limit, setLimit] = useState(finderPageSize);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const firstRequest = useRef(true);
  const finder = useRef<HTMLElement>(null);

  useEffect(() => { finder.current?.setAttribute("data-ready", "true"); }, []);

  useEffect(() => {
    if (firstRequest.current) { firstRequest.current = false; return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: String(limit) });
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    types.forEach((value) => params.append("type", value));
    brands.forEach((value) => params.append("brand", value));
    attributes.forEach((value) => params.append("attribute", value));
    absorbencies.forEach((value) => params.append("absorbency", value));
    availability.forEach((value) => params.append("availability", value));
    if (position) { params.set("lat", String(position.latitude)); params.set("lng", String(position.longitude)); }
    setLoading(true);
    let cancelAnalytics: (() => void) | undefined;
    fetch(`/api/locations?${params}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Location search failed"); return response.json() as Promise<LocationSearchResult>; })
      .then((nextResult) => {
        setResult(nextResult); setLocationMessage(nextResult.proximityLabel || ""); setSelected((current) => current && nextResult.mapItems.some((location) => location.slug === current) ? current : null);
        const filterCount = types.length + brands.length + attributes.length + absorbencies.length + availability.length;
        const hasText = Boolean(deferredQuery.trim());
        if (limit === finderPageSize && (hasText || filterCount || position)) {
          const searchMode: FinderSearchMode = position && !hasText && !filterCount ? "location" : hasText && !filterCount && !position ? "text" : !hasText && filterCount && !position ? "filters" : "combined";
          cancelAnalytics = scheduleFinderSearch(analyticsEvents, searchMode, nextResult.totalMatches);
        }
      })
      .catch((error: unknown) => { if (error instanceof Error && error.name !== "AbortError") setLocationMessage("Search could not be refreshed. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); cancelAnalytics?.(); };
  }, [absorbencies, attributes, availability, brands, deferredQuery, limit, position, types]);

  const resetResultLimit = () => setLimit(finderPageSize);
  const activeConstraintCount = types.length + brands.length + attributes.length + absorbencies.length + availability.length + (query.trim() ? 1 : 0);
  const clearAll = () => {
    setQuery(""); setTypes([]); setBrands([]); setAttributes([]); setAbsorbencies([]); setAvailability([]); setPosition(null); setLocationMessage(""); setLimit(finderPageSize);
  };
  const selectLocation = useCallback((slug: string) => {
    setSelected(slug);
    const card = document.getElementById(`location-${slug}`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    else router.push(`/location/${slug}`);
  }, [router]);

  function locateMe() {
    if (!navigator.geolocation) return setLocationMessage("Location is not supported by this browser.");
    setLocationMessage("Finding you…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { resetResultLimit(); setPosition({ latitude: coords.latitude, longitude: coords.longitude }); setLocationMessage("Sorted by distance from you."); },
      () => setLocationMessage("We could not access your location. You can still search by place or postcode."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return <section ref={finder} id="finder" className="finder-shell" aria-labelledby="finder-title">
    <div className="finder-topline"><div><p className="eyebrow">UK-ready community map</p><h2 id="finder-title">Find products that suit you</h2></div><p className="result-count" aria-live="polite" aria-atomic="true"><strong>{result.totalMatches}</strong> matching {result.totalLocations} verified locations</p></div>
    <div className="search-row"><label className="search-box"><span className="visually-hidden">Search locations, products or brands</span><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { resetResultLimit(); setQuery(event.target.value); }} placeholder="Place, postcode, product or brand" /></label><button className="secondary-button" onClick={locateMe} type="button">Use my location</button></div>
    <p className="status" aria-live="polite">{loading ? "Updating results…" : locationMessage || (activeConstraintCount ? `${activeConstraintCount} search or filter selection${activeConstraintCount === 1 ? "" : "s"} applied.` : `No filters selected — showing all ${result.totalLocations} locations on the map.`)}</p>
    <div className="filter-panel" aria-label="Product filters">
      <div className="filter-heading"><div><strong>Filter the evidence</strong><small>Search and filter selections combine to narrow results.</small></div>{activeConstraintCount ? <button className="text-button" type="button" onClick={clearAll}>Clear all ({activeConstraintCount})</button> : null}</div>
      <FilterGroup label="Product type" values={facets.types} selected={types} onToggle={(value) => { resetResultLimit(); setTypes((current) => toggleValue(current, value)); }} />
      <FilterGroup label="Brand" values={facets.brands} selected={brands} onToggle={(value) => { resetResultLimit(); setBrands((current) => toggleValue(current, value)); }} />
      <FilterGroup label="Materials and preferences" values={facets.attributes} selected={attributes} onToggle={(value) => { resetResultLimit(); setAttributes((current) => toggleValue(current, value)); }} />
      <FilterGroup label="Flow / absorbency" values={facets.absorbencies} selected={absorbencies} onToggle={(value) => { resetResultLimit(); setAbsorbencies((current) => toggleValue(current, value) as Absorbency[]); }} />
      <FilterGroup label="Latest moderated visit" values={facets.availability.map((value) => availabilityLabels[value])} selected={availability.map((value) => availabilityLabels[value as AvailabilityStatus])} onToggle={(label) => { const value = Object.entries(availabilityLabels).find(([, text]) => text === label)?.[0]; if (value) { resetResultLimit(); setAvailability((current) => toggleValue(current, value)); } }} />
    </div>
    <div className="finder-grid"><div className="results" aria-label="Matching locations" aria-busy={loading}>
      {!result.items.length ? <div className="empty-state"><h3>No matching locations yet</h3><p>Clear your search or filters, or help add what you found anywhere in the UK.</p>{activeConstraintCount ? <button className="text-button" type="button" onClick={clearAll}>Clear search and filters</button> : <Link href="/contribute">Suggest a location</Link>}</div> : null}
      {result.items.map((location) => { const latest = location.communityVerification?.latestAvailability; return <article id={`location-${location.slug}`} key={location.slug} className={selected === location.slug ? "location-card selected" : "location-card"} onMouseEnter={() => setSelected(location.slug)}>
        <div className="card-heading"><div><p className="city-label">{location.city}, {location.nation} · {location.venueType}</p><h3>{location.name}</h3></div><span className={`confidence ${location.confidence}`} title={getConfidencePresentation(location.confidence).explanation}>{getConfidencePresentation(location.confidence).shortLabel}</span></div>
        <p>{location.address}, {location.postcode}</p>
        {location.venueType === "Health venue" ? <p className="access-warning"><strong>Patient access only.</strong> Ask staff while receiving NHS care; this is not a general public pickup point.</p> : null}
        {latest ? <p className={`availability-line availability-${latest}`}>{availabilityLabels[latest]} · {new Date(location.communityVerification!.lastObservedAt!).toLocaleDateString("en-GB")}</p> : location.lastVerifiedAt ? <p className={location.needsRecheck ? "verification-line stale" : "verification-line"}>{location.needsRecheck ? "Needs rechecking" : "Evidence checked"} · {new Date(location.lastVerifiedAt).toLocaleDateString("en-GB")}</p> : null}
        <div className="chips">{location.products.map((product, index) => <span className="product-chip" key={`${product.type}-${product.brand}-${index}`}>{product.type}{product.brand ? ` · ${product.brand}` : " · brand not confirmed"}</span>)}</div>
        <div className="card-actions"><Link href={`/location/${location.slug}`}>Details and visits</Link><a href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Directions ↗</a></div>
      </article>; })}
      {result.hasMore ? <div className="load-more"><button className="secondary-button" type="button" disabled={loading} onClick={() => setLimit((current) => current + finderPageSize)}>{loading ? "Loading…" : `Show more (${result.totalMatches - result.items.length} remaining)`}</button></div> : null}
    </div><div className="map-wrap"><MapPanel locations={result.mapItems} selected={selected} onSelect={selectLocation} /><p className="map-caption">All {result.totalMatches} matching locations are shown as pins; details are loaded in batches of {finderPageSize}.</p></div></div>
  </section>;
}
