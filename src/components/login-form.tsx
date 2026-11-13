"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/app/actions";
import type { ActionState } from "@/types/forms";

const initialState: ActionState = { success: false, message: "" };

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(loginAdmin, initialState);
  return <form className="panel login-form" action={action}>
    <label>Admin password<input name="password" type="password" required minLength={12} autoComplete="current-password" disabled={!configured} /></label>
    <button className="primary-button" disabled={pending || !configured} type="submit">{pending ? "Signing in…" : "Sign in"}</button>
    <p className={state.message ? "form-note action-message error" : "form-note"} aria-live="polite">{state.message || (configured ? "Sessions expire after eight hours." : "Set ADMIN_PASSWORD and SESSION_SECRET to enable admin access.")}</p>
  </form>;
}
