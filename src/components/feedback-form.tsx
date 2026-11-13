"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitFeedback } from "@/app/actions";
import { analyticsEvents } from "@/lib/analytics";
import type { ActionState } from "@/types/forms";

const initialState: ActionState = { success: false, message: "" };

export function FeedbackForm() {
  const [state, action, pending] = useActionState(submitFeedback, initialState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) { analyticsEvents.feedbackSubmitted(); form.current?.reset(); } }, [state]);
  const error = (field: string) => state.errors?.[field]?.[0];
  return <form ref={form} className="panel form-grid" action={action}>
    <label>How useful was Period Place?<select required name="usefulness" defaultValue=""><option value="" disabled>Choose 1–5</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value} — {value===1?"not useful":value===5?"very useful":""}</option>)}</select>{error("usefulness")?<small className="field-error">{error("usefulness")}</small>:null}</label>
    <label>Did you find what you needed?<select required name="foundWhatNeeded" defaultValue=""><option value="" disabled>Choose one</option><option value="yes">Yes</option><option value="partly">Partly</option><option value="no">No</option></select>{error("foundWhatNeeded")?<small className="field-error">{error("foundWhatNeeded")}</small>:null}</label>
    <label>Did you trust the location information?<select required name="trustedResults" defaultValue=""><option value="" disabled>Choose one</option><option value="yes">Yes</option><option value="partly">Partly</option><option value="no">No</option></select>{error("trustedResults")?<small className="field-error">{error("trustedResults")}</small>:null}</label>
    <label>Did you try reporting an update?<select required name="submittedUpdate" defaultValue=""><option value="" disabled>Choose one</option><option value="yes">Yes, successfully</option><option value="no">Yes, but I could not finish</option><option value="not_tried">I did not try</option></select>{error("submittedUpdate")?<small className="field-error">{error("submittedUpdate")}</small>:null}</label>
    <label>Would you use Period Place again?<select required name="wouldUseAgain" defaultValue=""><option value="" disabled>Choose one</option><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select>{error("wouldUseAgain")?<small className="field-error">{error("wouldUseAgain")}</small>:null}</label>
    <label className="full-field">What should improve?<textarea required name="comments" minLength={5} maxLength={1000} rows={5} placeholder="For example: a missing brand, confusing filter, or inaccessible location…" />{error("comments")?<small className="field-error">{error("comments")}</small>:null}</label>
    <label className="honeypot-field" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <button className="primary-button" disabled={pending} type="submit">{pending?"Sending…":"Send feedback"}</button>
    <p className={state.message?`form-note action-message ${state.success?"success":"error"}`:"form-note"} aria-live="polite">{state.message||"Please do not include personal or sensitive information."}</p>
  </form>;
}
