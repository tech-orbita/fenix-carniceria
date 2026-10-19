import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Comprobación optimista: sin sesión se va al login. Los permisos reales los validan
// las páginas, las acciones del servidor y RLS en la base de datos.
export async function proxy(request: NextRequest) {
  const { response, authenticated } = await updateSession(request);
  const isLogin = request.nextUrl.pathname === "/login";

  if (authenticated === isLogin) {
    const redirect = NextResponse.redirect(new URL(isLogin ? "/" : "/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
