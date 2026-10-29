"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { validateNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    const client = createClient();
    supabaseRef.current = client;
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(Boolean(data.session));
      setChecking(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setReady(Boolean(session));
      setChecking(false);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    const validation = validateNewPassword(password, confirmation);
    if (validation) { setMessage({ ok: false, text: validation }); return; }
    const supabase = supabaseRef.current;
    if (!ready || !supabase) { setMessage({ ok: false, text: "El enlace no es válido o ya venció. Solicita uno nuevo." }); return; }

    setPending(true);
    setMessage(undefined);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPending(false);
      setMessage({ ok: false, text: "No fue posible actualizar la contraseña. Solicita un enlace nuevo." });
      return;
    }
    await supabase.auth.signOut({ scope: "global" });
    window.location.replace("/login?password=updated");
  };

  if (checking) return <p className="auth-status">Validando el enlace…</p>;

  return (
    <form className="auth-form" onSubmit={submit}>
      <label><span>Nueva contraseña</span><input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
      <label><span>Confirmar contraseña</span><input autoComplete="new-password" minLength={8} name="confirmation" required type="password" /></label>
      {message && <p className={message.ok ? "auth-success" : "auth-error"} role="status">{message.text}</p>}
      <button className="auth-submit" disabled={pending || !ready} type="submit">{pending ? "Actualizando…" : "Guardar contraseña"}</button>
      {!ready && <Link className="auth-link" href="/recuperar-contrasena">Solicitar un enlace nuevo</Link>}
    </form>
  );
}
