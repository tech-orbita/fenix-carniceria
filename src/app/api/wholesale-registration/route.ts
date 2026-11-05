import { NextResponse } from "next/server";

import { customerIdentityKey } from "@/lib/orders/wholesale-routes";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RegistrationValidationError,
  syncWholesaleRegistrationToHighLevel,
  validateWholesaleRegistration,
} from "@/lib/wholesale-registration";

export const runtime = "nodejs";

const attempts = new Map<string, number[]>();

function rateLimited(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((time) => now - time < 10 * 60_000);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > 8;
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (rateLimited(request)) return NextResponse.json({ error: "Demasiados intentos. Intenta nuevamente en unos minutos." }, { status: 429 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 30_000) return NextResponse.json({ error: "El formulario es demasiado grande." }, { status: 413 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el formulario." }, { status: 400 });
  }
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  // Campo trampa para bots. Respondemos igual que un registro normal sin persistir nada.
  if (typeof record.website === "string" && record.website.trim()) {
    return NextResponse.json({ ok: true, synced: true });
  }

  try {
    const registration = validateWholesaleRegistration(raw);
    const supabase = createAdminClient();
    // Un mayorista se identifica por establecimiento: varios negocios pueden compartir
    // teléfono, así que el teléfono no sirve para decidir qué ficha actualizar.
    const identityKey = customerIdentityKey("wholesale", { businessName: registration.businessName, name: registration.name });
    const selectFields = "id,email";
    const [{ data: byIdentity, error: identityError }, { data: byEmail, error: emailError }] = await Promise.all([
      supabase.from("customers").select(selectFields).eq("customer_type", "wholesale").eq("identity_key", identityKey).maybeSingle(),
      supabase.from("customers").select(selectFields).eq("customer_type", "wholesale").ilike("email", registration.email).limit(2),
    ]);
    if (identityError || emailError) throw new Error("No se pudo consultar el registro de clientes");
    if (!byIdentity && (byEmail?.length ?? 0) > 1) {
      return NextResponse.json({ error: "El correo ya aparece en más de un registro. Comunícate con Fénix para actualizar tus datos." }, { status: 409 });
    }

    const existing = byIdentity ?? byEmail?.[0];
    const registeredAt = new Date().toISOString();
    const customerValues = {
      customer_type: "wholesale",
      identity_key: identityKey,
      name: registration.name,
      business_name: registration.businessName,
      tax_id: registration.taxId,
      phone: registration.phone,
      email: registration.email,
      address: registration.address,
      neighborhood: registration.neighborhood,
      city: registration.city,
      billing_address: registration.address,
      requires_e_invoice: registration.requiresInvoice,
      wholesale_registered_at: registeredAt,
      registration_source: "public_wholesale_form",
      registration_metadata: { consent_at: registeredAt, form_version: 1 },
      ghl_sync_status: "pending",
      ghl_sync_error: null,
    };

    const customerQuery = existing
      ? supabase.from("customers").update(customerValues).eq("id", existing.id)
      : supabase.from("customers").insert(customerValues);
    const { data: customer, error: customerError } = await customerQuery.select("id").single();
    if (customerError || !customer) {
      if (customerError?.code === "23505") {
        return NextResponse.json({ error: "Ya existe una inscripción con ese negocio o correo. Verifica los datos o comunícate con Fénix." }, { status: 409 });
      }
      throw new Error("No se pudo guardar la inscripción");
    }

    try {
      const highLevel = await syncWholesaleRegistrationToHighLevel(registration);
      const { error: syncUpdateError } = await supabase.from("customers").update({
        ghl_contact_id: highLevel.contactId,
        ghl_sync_status: "synced",
        ghl_sync_error: null,
      }).eq("id", customer.id);
      if (syncUpdateError) throw new Error("El contacto se sincronizó, pero no se pudo guardar su estado local");
      return NextResponse.json({
        ok: true,
        synced: true,
        message: "Tu inscripción mayorista quedó registrada correctamente.",
      });
    } catch (error) {
      const internalMessage = error instanceof Error ? error.message : "Error desconocido";
      console.error("[wholesale-registration] No se pudo sincronizar HighLevel", { customerId: customer.id, message: internalMessage });
      await supabase.from("customers").update({
        ghl_sync_status: "error",
        ghl_sync_error: internalMessage.slice(0, 500),
      }).eq("id", customer.id);
      return NextResponse.json({
        ok: true,
        synced: false,
        message: "Recibimos tu inscripción. La sincronización interna quedó pendiente y no necesitas volver a llenar el formulario.",
      }, { status: 202 });
    }
  } catch (error) {
    if (error instanceof RegistrationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[wholesale-registration] Error al registrar", {
      message: error instanceof Error ? error.message : "Error desconocido",
    });
    return NextResponse.json({ error: "No pudimos completar la inscripción. Intenta nuevamente." }, { status: 500 });
  }
}
