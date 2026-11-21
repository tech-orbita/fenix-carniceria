import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";
import { hasSupabaseEnvironment } from "@/lib/supabase/config";

// Comprobación optimista: sin sesión se va al login. Los permisos reales los validan
// las páginas, las acciones del servidor y RLS en la base de datos.
export async function proxy(request: NextRequest) {
  const { response, authenticated } = await updateSession(request);
  // Sin credenciales solo se muestran datos ficticios del modo demostración.
  if (!hasSupabaseEnvironment()) return response;
  const pathname = request.nextUrl.pathname;
  const isLocalDemo = process.env.NODE_ENV !== "production"
    && pathname === "/dashboard"
    && request.nextUrl.searchParams.get("demo") === "contacto";
  if (isLocalDemo) return response;
  const isLogin = pathname === "/login";
  const isPublicAuthRoute = isLogin
    || pathname === "/recuperar-contrasena"
    || pathname === "/restablecer-contrasena"
    || pathname === "/auth/callback"
    || pathname === "/registro-mayorista"
    || pathname === "/pedido-mayorista"
    || pathname.startsWith("/pedido-mayorista/");

  if ((authenticated && isLogin) || (!authenticated && !isPublicAuthRoute)) {
    const redirect = NextResponse.redirect(new URL(authenticated ? "/" : "/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
