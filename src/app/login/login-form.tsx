"use client";

import { useActionState } from "react";

import { signIn } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="auth-form">
      <label>
        <span>Correo</span>
        <input autoComplete="email" defaultValue={state.email} name="email" required type="email" />
      </label>
      <label>
        <span>Contraseña</span>
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      {state.message && <p className="auth-error" role="alert">{state.message}</p>}
      <button className="auth-submit" disabled={pending} type="submit">{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
