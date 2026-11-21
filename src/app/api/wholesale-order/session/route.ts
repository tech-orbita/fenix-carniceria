import { NextRequest, NextResponse } from "next/server";

import { normalizedCustomerPhone, normalizedTaxId } from "@/lib/orders/wholesale-routes";
import { createWholesalePortalSession, portalFingerprint, readWholesalePortalSession, sameOrigin, wholesalePortalCookie } from "@/lib/orders/wholesale-portal-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function customerDetails(customerId: number) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("id,name,business_name,address,neighborhood,city,routes(name)")
    .eq("id", customerId)
    .eq("customer_type", "wholesale")
    .eq("is_active", true)
    .not("wholesale_registered_at", "is", null)
    .maybeSingle();
  if (!data) return null;
  const route = Array.isArray(data.routes) ? data.routes[0] : data.routes;
  return {
    id: data.id,
    name: data.name,
    businessName: data.business_name || data.name,
    address: [data.address, data.neighborhood, data.city].filter(Boolean).join(", "),
    route: route?.name || "Sin clasificar",
  };
}

export async function GET(request: NextRequest) {
  const session = readWholesalePortalSession(request.cookies.get(wholesalePortalCookie)?.value);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  const customer = await customerDetails(session.customerId);
  if (!customer) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, customer });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 5_000) {
    return NextResponse.json({ error: "La solicitud es demasiado grande." }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "No pudimos leer los datos." }, { status: 400 }); }
  const phone = normalizedCustomerPhone(typeof body.phone === "string" ? body.phone : "");
  const taxId = normalizedTaxId(typeof body.taxId === "string" ? body.taxId : "");
  if (!phone || !taxId) return NextResponse.json({ error: "Escribe el teléfono y el NIT o cédula registrados." }, { status: 422 });

  const supabase = createAdminClient();
  const fingerprint = portalFingerprint(request, `${phone}:${taxId}`);
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await supabase
    .from("wholesale_portal_access_attempts")
    .select("id", { head: true, count: "exact" })
    .eq("client_fingerprint", fingerprint)
    .gte("attempted_at", cutoff);
  if ((count ?? 0) >= 8) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos antes de volver a intentar." }, { status: 429 });
  }

  const { data: candidates, error } = await supabase
    .from("customers")
    .select("id,name,business_name,tax_id,phone")
    .eq("customer_type", "wholesale")
    .eq("is_active", true)
    .not("wholesale_registered_at", "is", null);
  if (error) return NextResponse.json({ error: "No pudimos verificar el registro. Intenta nuevamente." }, { status: 500 });
  const matches = (candidates ?? []).filter((customer) =>
    normalizedCustomerPhone(customer.phone) === phone && normalizedTaxId(customer.tax_id) === taxId,
  );
  const succeeded = matches.length === 1;
  await supabase.from("wholesale_portal_access_attempts").insert({ client_fingerprint: fingerprint, succeeded });
  if (!succeeded) {
    return NextResponse.json({ error: "No encontramos un único cliente registrado con esos datos. Verifica el teléfono y el NIT o cédula." }, { status: 404 });
  }
  const customer = await customerDetails(matches[0].id);
  if (!customer) return NextResponse.json({ error: "El registro no está disponible." }, { status: 404 });
  const session = createWholesalePortalSession(customer.id);
  const response = NextResponse.json({ authenticated: true, customer });
  response.cookies.set(wholesalePortalCookie, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
    priority: "high",
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(wholesalePortalCookie, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

