export function hasSupabaseEnvironment() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

// El panel se usa embebido en GoHighLevel (iframe de otro dominio): en producción la
// cookie de sesión debe ser SameSite=None; Secure para que el navegador la envíe.
export const sessionCookieOptions =
  process.env.NODE_ENV === "production"
    ? { sameSite: "none" as const, secure: true }
    : { sameSite: "lax" as const };
