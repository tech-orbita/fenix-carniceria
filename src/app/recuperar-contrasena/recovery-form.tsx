"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "./actions";

export function RecoveryForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Correo</span>
        <input autoComplete="email" defaultValue={state.email} name="email" required type="email" />
      </label>
      {state.message && <p className={state.ok ? "auth-success" : "auth-error"} role="status">{state.message}</p>}
      <button className="auth-submit" disabled={pending} type="submit">{pending ? "Enviando…" : "Enviar enlace"}</button>
      <Link className="auth-link" href="/login">Volver a iniciar sesión</Link>
    </form>
  );
}
