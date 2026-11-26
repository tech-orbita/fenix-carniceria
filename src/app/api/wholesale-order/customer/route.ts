import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { wholesaleBusinessesForPhone } from "@/lib/orders/wholesale-customer-lookup";
import { normalizedWholesalePhone } from "@/lib/orders/wholesale-routes";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try { return new URL(origin).host === expectedHost; }
  catch { return false; }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 2_000) return NextResponse.json({ error: "Solicitud inválida." }, { status: 413 });

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "No pudimos leer el teléfono." }, { status: 400 }); }
  const phone = typeof raw === "object" && raw && !Array.isArray(raw) && typeof (raw as { phone?: unknown }).phone === "string"
    ? (raw as { phone: string }).phone.trim().slice(0, 30)
    : "";
  const normalizedPhone = normalizedWholesalePhone(phone);
  if (normalizedPhone.replace(/\D/g, "").length < 8) return NextResponse.json({ error: "Escribe un teléfono válido." }, { status: 422 });

  const supabase = createAdminClient();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const fingerprint = createHash("sha256").update(`${ip}:customer-lookup`).digest("hex");
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count, error: attemptsError } = await supabase.from("wholesale_portal_access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("client_fingerprint", fingerprint)
    .gte("attempted_at", cutoff);
  if (attemptsError) return NextResponse.json({ error: "No pudimos comprobar el teléfono." }, { status: 500 });
  if ((count ?? 0) >= 30) return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });
  await supabase.from("wholesale_portal_access_attempts").insert({ client_fingerprint: fingerprint, succeeded: false });

  const { data: customers, error } = await supabase.from("customers")
    .select("id,name,business_name,phone")
    .eq("customer_type", "wholesale")
    .eq("is_active", true)
    .not("wholesale_registered_at", "is", null);
  if (error) return NextResponse.json({ error: "No pudimos consultar los establecimientos." }, { status: 500 });

  const businesses = wholesaleBusinessesForPhone(customers ?? [], phone);
  await supabase.from("wholesale_portal_access_attempts").update({ succeeded: true }).eq("client_fingerprint", fingerprint).eq("succeeded", false);
  return NextResponse.json({ businesses, registrationRequired: businesses.length === 0 });
}
