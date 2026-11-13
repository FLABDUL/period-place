"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitContactRequest } from "@/app/actions";
import { contactKinds } from "@/lib/contact-schema";
import type { ActionState } from "@/types/forms";

const initialState: ActionState = { success: false, message: "" };
const labels = { general: "General question", sponsorship: "Responsible sponsorship", privacy_deletion: "Privacy or deletion request" } as const;

export function ContactForm({ initialKind = "general" }: { initialKind?: (typeof contactKinds)[number] }) {
  const [state, action, pending] = useActionState(submitContactRequest, initialState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) form.current?.reset(); }, [state.success]);
  const error = (field: string) => state.errors?.[field]?.[0];
  return <form ref={form} className="panel form-grid" action={action}>
    <label className="full-field">What is this about?<select name="kind" required defaultValue={initialKind}>{contactKinds.map((kind) => <option key={kind} value={kind}>{labels[kind]}</option>)}</select>{error("kind") ? <small className="field-error">{error("kind")}</small> : null}</label>
    <label className="full-field">Your email address<input name="email" type="email" required maxLength={254} autoComplete="email" />{error("email") ? <small className="field-error">{error("email")}</small> : null}</label>
    <label className="full-field">Message<textarea name="message" required minLength={10} maxLength={2000} rows={6} placeholder="Tell us what you need. For deletion requests, use the email address associated with your Period Place account." />{error("message") ? <small className="field-error">{error("message")}</small> : null}</label>
    <label className="honeypot-field" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Sending…" : "Send private request"}</button>
    <p className={state.message ? `form-note action-message ${state.success ? "success" : "error"}` : "form-note"} aria-live="polite">{state.message || "This request is stored privately and is visible only to the Period Place administrator."}</p>
  </form>;
}
