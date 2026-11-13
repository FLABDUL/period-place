"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { submitLocation } from "@/app/actions";
import { analyticsEvents } from "@/lib/analytics";
import type { ActionState } from "@/types/forms";
import { absorbencies, productTypes, ukNations } from "@/types/location";

const initialState: ActionState = { success: false, message: "" };

type LocationOption = { slug: string; name: string; city: string; nation: string; adminArea: string; postcode: string };

type ReportKind = "new_location" | "correction" | "stock_update" | "closure";

function optionLabel(location: LocationOption) {
  return `${location.name} · ${location.city}, ${location.nation} · ${location.postcode}`;
}

export function ContributionForm({ locations, initialKind = "new_location", initialTargetSlug = "" }: { locations: LocationOption[]; initialKind?: ReportKind; initialTargetSlug?: string }) {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [state, action, pending] = useActionState(submitLocation, initialState);
  const previous = state.values || {};
  const restoredTargetSlug = String(previous.targetSlug || initialTargetSlug);
  const initialTarget = locations.find((location) => location.slug === restoredTargetSlug);
  const [reportKind, setReportKind] = useState<ReportKind>((previous.reportKind as ReportKind) || initialKind);
  const [targetSlug, setTargetSlug] = useState(initialTarget?.slug || "");
  const [targetLabel, setTargetLabel] = useState(initialTarget ? optionLabel(initialTarget) : "");
  const previousProducts = Array.isArray(previous.products) ? previous.products : typeof previous.products === "string" ? [previous.products] : [];
  const previousAbsorbencies = Array.isArray(previous.absorbencies) ? previous.absorbencies : typeof previous.absorbencies === "string" ? [previous.absorbencies] : [];
  const [values, setValues] = useState({ place: String(previous.place || ""), city: String(previous.city || ""), nation: String(previous.nation || ""), adminArea: String(previous.adminArea || ""), postcode: String(previous.postcode || ""), seenAt: String(previous.seenAt || ""), brand: String(previous.brand || ""), notes: String(previous.notes || ""), changed: previousProducts.join(", ") });
  const [products, setProducts] = useState<string[]>(previousProducts);
  const [selectedAbsorbencies, setSelectedAbsorbencies] = useState<string[]>(previousAbsorbencies);
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.success) analyticsEvents.reportSubmitted();
    else if (state.message) errorSummary.current?.focus();
  }, [state]);
  const error = (field: string) => state.errors?.[field]?.[0];
  const target = locations.find((location) => location.slug === targetSlug);
  const locationsByLabel = useMemo(() => new Map(locations.map((location) => [optionLabel(location), location])), [locations]);
  const isNewLocation = reportKind === "new_location";
  const visibleErrors = Object.entries(state.errors || {}).filter(([field]) => field !== "website").flatMap(([, messages]) => messages || []);
  const setValue = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));

  return <form className="panel form-grid" action={action} data-ready={hydrated}>
    <label className="full-field">What are you reporting?<select required name="reportKind" value={reportKind} onChange={(event) => { setReportKind(event.target.value as ReportKind); setTargetSlug(""); setTargetLabel(""); }}><option value="new_location">A new location</option><option value="correction">A correction</option><option value="stock_update">A stock or brand change</option><option value="closure">A location that is closed or unavailable</option></select></label>
    {!isNewLocation ? <label className="full-field">Existing location<input required list="existing-locations" value={targetLabel} onChange={(event) => { const value = event.target.value; setTargetLabel(value); setTargetSlug(locationsByLabel.get(value)?.slug || ""); }} placeholder="Start typing a place, town or postcode" autoComplete="off" aria-describedby={`location-search-help${error("targetSlug") ? " target-location-error" : ""}`} /><input type="hidden" name="targetSlug" value={targetSlug} /><datalist id="existing-locations">{locations.map((location) => <option key={location.slug} value={optionLabel(location)} />)}</datalist><small id="location-search-help">Choose an exact suggestion from the searchable list.</small>{error("targetSlug") ? <small id="target-location-error" className="field-error">{error("targetSlug")}</small> : null}</label> : <input type="hidden" name="targetSlug" value="" />}
    {isNewLocation ? <><label>Place name<input required name="place" maxLength={120} value={values.place} onChange={(event)=>setValue("place",event.target.value)} placeholder="e.g. Leith Library" aria-invalid={Boolean(error("place"))} aria-describedby={error("place") ? "place-error" : undefined} />{error("place") ? <small id="place-error" className="field-error">{error("place")}</small> : null}</label>
    <label>Town or city<input required name="city" maxLength={120} value={values.city} onChange={(event)=>setValue("city",event.target.value)} placeholder="e.g. Glasgow" aria-invalid={Boolean(error("city"))} />{error("city") ? <small className="field-error">{error("city")}</small> : null}</label>
    <label>UK nation<select required name="nation" value={values.nation} onChange={(event)=>setValue("nation",event.target.value)} aria-invalid={Boolean(error("nation"))}><option value="" disabled>Choose one</option>{ukNations.map((nation)=><option key={nation}>{nation}</option>)}</select>{error("nation") ? <small className="field-error">{error("nation")}</small> : null}</label>
    <label>Council area <small>(optional)</small><input name="adminArea" maxLength={120} value={values.adminArea} onChange={(event)=>setValue("adminArea",event.target.value)} placeholder="e.g. Glasgow City" />{error("adminArea") ? <small className="field-error">{error("adminArea")}</small> : null}</label>
    <label>Postcode<input required name="postcode" maxLength={10} value={values.postcode} onChange={(event)=>setValue("postcode",event.target.value)} autoCapitalize="characters" aria-invalid={Boolean(error("postcode"))} />{error("postcode") ? <small className="field-error">{error("postcode")}</small> : null}</label></> : <><input type="hidden" name="place" value={target?.name || ""} /><input type="hidden" name="city" value={target?.city || ""} /><input type="hidden" name="nation" value={target?.nation || "Scotland"} /><input type="hidden" name="adminArea" value={target?.adminArea || ""} /><input type="hidden" name="postcode" value={target?.postcode || ""} /></>}
    <label>Date seen<input name="seenAt" type="date" value={values.seenAt} onChange={(event)=>setValue("seenAt",event.target.value)} />{error("seenAt") ? <small className="field-error">{error("seenAt")}</small> : null}</label>
    {isNewLocation?<fieldset className="full-field product-fieldset"><legend>Products seen</legend>{productTypes.map((type)=><label key={type}><input type="checkbox" name="products" value={type} checked={products.includes(type)} onChange={()=>setProducts((current)=>current.includes(type)?current.filter((item)=>item!==type):[...current,type])}/>{type}</label>)}{error("products") ? <small className="field-error">{error("products")}</small> : null}</fieldset>:<label>What changed?<input required name="products" maxLength={300} value={values.changed} onChange={(event)=>setValue("changed",event.target.value)} placeholder="Describe the correction, stock or access change" aria-invalid={Boolean(error("products"))} />{error("products") ? <small className="field-error">{error("products")}</small> : null}</label>}
    {isNewLocation?<fieldset className="full-field product-fieldset"><legend>Flow / absorbency seen <small>(optional)</small></legend>{absorbencies.map((value)=><label key={value}><input type="checkbox" name="absorbencies" value={value} checked={selectedAbsorbencies.includes(value)} onChange={()=>setSelectedAbsorbencies((current)=>current.includes(value)?current.filter((item)=>item!==value):[...current,value])}/>{value}</label>)}</fieldset>:null}
    <label>Brand, if visible<input name="brand" maxLength={120} value={values.brand} onChange={(event)=>setValue("brand",event.target.value)} placeholder="It is useful to say unknown" />{error("brand") ? <small className="field-error">{error("brand")}</small> : null}</label>
    <label className="full-field">Notes<textarea name="notes" maxLength={1000} rows={4} value={values.notes} onChange={(event)=>setValue("notes",event.target.value)} placeholder="Where were they? Was the dispenser stocked?" />{error("notes") ? <small className="field-error">{error("notes")}</small> : null}</label>
    {!state.success && state.message ? <div ref={errorSummary} className="form-error-summary full-field" role="alert" tabIndex={-1}><strong>{state.message}</strong>{visibleErrors.length ? <ul>{visibleErrors.map((message,index)=><li key={`${message}-${index}`}>{message}</li>)}</ul> : null}</div> : null}
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Sending…" : "Send for review"}</button>
    <p className={state.message ? `form-note action-message ${state.success ? "success" : "error"}` : "form-note"} aria-live="polite">{state.message || "Suggestions are stored securely on this server and remain hidden until reviewed."}</p>
  </form>;
}
