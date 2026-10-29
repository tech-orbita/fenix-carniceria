"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signIn } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Correo</span>
        <input autoComplete="email" defaultValue={state.email} name="email" required type="email" />
      </label>
      <label>
        <span>Contraseña</span>
        <div className="auth-password-field">
          <input autoComplete="current-password" name="password" required type={showPassword ? "text" : "password"} />
          <button
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            className="auth-password-toggle"
            onClick={() => setShowPassword((visible) => !visible)}
            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            type="button"
          >
            {showPassword ? (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.4 9 5.4a15.7 15.7 0 0 1-2.2 2.7M6.6 6.6C4.3 8 3 10 3 10s3.5 6 9 6a9.8 9.8 0 0 0 3.4-.6" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            )}
          </button>
        </div>
      </label>
      {notice && <p className="auth-success" role="status">{notice}</p>}
      {state.message && <p className="auth-error" role="alert">{state.message}</p>}
      <button className="auth-submit" disabled={pending} type="submit">{pending ? "Entrando…" : "Entrar"}</button>
      <Link className="auth-link" href="/recuperar-contrasena">Olvidé mi contraseña</Link>
    </form>
  );
}
