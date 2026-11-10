"use server";

import { headers } from "next/headers";

import { resolveSiteUrl } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

export type RecoveryState = { ok?: boolean; message?: string; email?: string };

export async function requestPasswordReset(_state: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Escribe un correo válido.", email };

  const requestHeaders = await headers();
  const siteUrl = resolveSiteUrl({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    requestOrigin: requestHeaders.get("origin"),
    vercelProductionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  });
  const redirectTo = `${siteUrl}/auth/callback?next=/restablecer-contrasena`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) return { ok: false, message: "No fue posible enviar el correo. Inténtalo nuevamente en unos minutos.", email };
  return {
    ok: true,
    email,
    message: "Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.",
  };
}
