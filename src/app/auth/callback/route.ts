import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { passwordRecoveryRedirect } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Enlace incompleto") };

  // Este callback pertenece exclusivamente al flujo de recuperación. El destino
  // no puede depender de que Supabase conserve parámetros anidados en redirectTo.
  if (!result.error) return NextResponse.redirect(passwordRecoveryRedirect(request.url));
  return NextResponse.redirect(new URL("/login?recovery=invalid", request.url));
}
