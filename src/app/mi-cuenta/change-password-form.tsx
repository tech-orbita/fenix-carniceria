"use client";

import { useActionState } from "react";

import { changeOwnPassword } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, {});
  return (
    <form action={action} className="auth-form">
      <label><span>Contraseña actual</span><input autoComplete="current-password" name="currentPassword" required type="password" /></label>
      <label><span>Nueva contraseña</span><input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
      <label><span>Confirmar contraseña</span><input autoComplete="new-password" minLength={8} name="confirmation" required type="password" /></label>
      {state.message && <p className={state.ok ? "auth-success" : "auth-error"} role="status">{state.message}</p>}
      <button className="auth-submit" disabled={pending} type="submit">{pending ? "Actualizando…" : "Cambiar contraseña"}</button>
    </form>
  );
}
