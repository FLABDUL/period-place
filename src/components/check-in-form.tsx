"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitCheckIn } from "@/app/actions";
import type { ActionState } from "@/types/forms";

const initialState: ActionState = { success: false, message: "" };

const availabilityOptions = [
  ["available", "Available and stocked"],
  ["low_stock", "Available but running low"],
  ["out_of_stock", "Dispenser or shelf was empty"],
  ["could_not_find", "I could not find the products"],
  ["location_unavailable", "The location was closed or unavailable"],
] as const;

function RatingSelect({ name, label }: { name: string; label: string }) {
  return <label>{label}<select name={name} defaultValue=""><option value="">Not rated</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value} / 5</option>)}</select></label>;
}

export function CheckInForm({ locationSlug }: { locationSlug: string }) {
  const [state, action, pending] = useActionState(submitCheckIn, initialState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) form.current?.reset(); }, [state.success]);
  const error = (field: string) => state.errors?.[field]?.[0];
  const today = new Date().toISOString().slice(0, 10);

  return <form ref={form} className="form-grid check-in-form" action={action}>
    <input type="hidden" name="locationSlug" value={locationSlug}/>
    <label className="full-field">What did you find?<select required name="availability" defaultValue=""><option value="" disabled>Choose one</option>{availabilityOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>{error("availability")?<small className="field-error">{error("availability")}</small>:null}</label>
    <label>Date visited<input required name="observedAt" type="date" max={today} defaultValue={today}/>{error("observedAt")?<small className="field-error">{error("observedAt")}</small>:null}</label>
    <span aria-hidden="true" />
    <RatingSelect name="accuracyRating" label="Listing accuracy"/>
    <RatingSelect name="accessRating" label="Ease of access"/>
    <RatingSelect name="privacyRating" label="Privacy and dignity"/>
    <label className="full-field">Optional comment<textarea name="comment" maxLength={500} rows={3} placeholder="For example: pads were beside reception; no need to ask staff."/>{error("comment")?<small className="field-error">{error("comment")}</small>:null}</label>
    <label className="honeypot-field" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
    <button className="primary-button" disabled={pending} type="submit">{pending?"Sending…":"Send visit for review"}</button>
    <p className={state.message?`form-note action-message ${state.success?"success":"error"}`:"form-note"} aria-live="polite">{state.message||"The structured status is required; ratings and comments are optional. Nothing appears publicly until moderated."}</p>
  </form>;
}
