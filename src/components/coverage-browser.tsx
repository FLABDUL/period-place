"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CoverageArea } from "@/lib/coverage";
import { ukNations } from "@/types/location";

export function CoverageBrowser({ areas }: { areas: CoverageArea[] }) {
  const [query, setQuery] = useState("");
  const browser = useRef<HTMLDivElement>(null);
  useEffect(() => { browser.current?.setAttribute("data-ready", "true"); }, []);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? areas.filter((area) => `${area.adminArea} ${area.nation}`.toLowerCase().includes(term)) : areas;
  }, [areas, query]);

  return <div ref={browser} className="coverage-browser">
    <label className="coverage-search">Search coverage areas<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Council area or UK nation" /></label>
    <p className="status" aria-live="polite">{filtered.length} of {areas.length} coverage areas shown</p>
    <div className="coverage-groups">
      {ukNations.map((nation) => {
        const nationAreas = filtered.filter((area) => area.nation === nation);
        if (!nationAreas.length) return null;
        return <details key={nation} open={Boolean(query.trim())}>
          <summary>{nation} <span>{nationAreas.length} area{nationAreas.length === 1 ? "" : "s"}</span></summary>
          <div className="coverage-table" role="table" aria-label={`${nation} published locations by coverage area`}>
            <div className="coverage-row coverage-heading" role="row"><span role="columnheader">Area</span><span role="columnheader">Nation</span><span role="columnheader">Locations</span><span role="columnheader">Named brand</span></div>
            {nationAreas.map((area) => <div className="coverage-row" role="row" key={`${area.nation}-${area.adminArea}`}><strong role="cell">{area.adminArea}</strong><span role="cell">{area.nation}</span><span role="cell">{area.locations}</span><span role="cell">{area.withNamedBrand}</span></div>)}
          </div>
        </details>;
      })}
      {!filtered.length ? <p className="empty-state">No coverage areas match that search.</p> : null}
    </div>
  </div>;
}
