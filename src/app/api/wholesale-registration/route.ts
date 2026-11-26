import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { customerIdentityKey, normalizedCustomerPhone, normalizedTaxId, normalizedWholesaleBusiness } from "@/lib/orders/wholesale-routes";
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
    const submissionId = typeof record.submissionId === "string" && /^[0-9a-f-]{36}$/i.test(record.submissionId)
      ? record.submissionId
      : randomUUID();
    const { data: auditSubmission } = await supabase.from("form_submissions").insert({
      form_type: "wholesale_registration",
      source: "system",
      idempotency_key: submissionId,
      status: "processing",
      integration_status: "pending",
      payload: {
        business_name: registration.businessName,
        phone: registration.phone,
        email: registration.email,
        city: registration.city,
      },
    }).select("id").maybeSingle();
    // La combinación establecimiento + teléfono permite separar sucursales con el
    // mismo nombre y también varios negocios atendidos por una misma persona.
    const identityKey = customerIdentityKey("wholesale", { businessName: registration.businessName, name: registration.name, phone: registration.phone });
    const selectFields = "id,email,tax_id,phone,business_name,wholesale_registered_at";
    const [{ data: byIdentity, error: identityError }, { data: byEmail, error: emailError }, { data: stableIdentityCandidates, error: stableIdentityError }] = await Promise.all([
      supabase.from("customers").select(selectFields).eq("customer_type", "wholesale").eq("identity_key", identityKey).maybeSingle(),
      supabase.from("customers").select(selectFields).eq("customer_type", "wholesale").ilike("email", registration.email).limit(2),
      supabase.from("customers").select(selectFields).eq("customer_type", "wholesale").eq("is_active", true),
    ]);
    if (identityError || emailError || stableIdentityError) throw new Error("No se pudo consultar el registro de clientes");
    const submittedBusiness = normalizedWholesaleBusiness(registration.businessName);
    const sameBusiness = (customer: { business_name: string | null }) => normalizedWholesaleBusiness(customer.business_name) === submittedBusiness;
    const matchingEmailCustomers = (byEmail ?? []).filter((customer) => sameBusiness(customer));
    if (!byIdentity && matchingEmailCustomers.length > 1) {
      return NextResponse.json({ error: "El correo ya aparece más de una vez para este establecimiento. Comunícate con Fénix para actualizar tus datos." }, { status: 409 });
    }
    const submittedTaxId = normalizedTaxId(registration.taxId);
    const matchingTaxCustomers = (stableIdentityCandidates ?? []).filter((customer) => normalizedTaxId(customer.tax_id) === submittedTaxId && sameBusiness(customer));
    if (matchingTaxCustomers.length > 1) {
      return NextResponse.json({ error: "La identificación aparece en más de un registro. Comunícate con Fénix para actualizar tus datos." }, { status: 409 });
    }
    const submittedPhone = normalizedCustomerPhone(registration.phone);
    const matchingPhoneCustomers = (stableIdentityCandidates ?? []).filter((customer) => normalizedCustomerPhone(customer.phone) === submittedPhone && sameBusiness(customer));
    const registeredPhoneCustomers = matchingPhoneCustomers.filter((customer) => customer.wholesale_registered_at);
    const customerByPhone = matchingPhoneCustomers.length === 1
      ? matchingPhoneCustomers[0]
      : registeredPhoneCustomers.length === 1 ? registeredPhoneCustomers[0] : undefined;
    const customerByEmail = matchingEmailCustomers[0];
    const existing = matchingTaxCustomers[0] ?? customerByPhone ?? byIdentity ?? customerByEmail;
    const registeredAt = new Date().toISOString();
    const customerValues = {
      customer_type: "wholesale",
      identity_key: identityKey,
      name: registration.name,
      business_name: existing?.business_name?.includes("·") ? existing.business_name : registration.businessName,
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
    if (auditSubmission) await supabase.from("form_submissions").update({ customer_id: customer.id }).eq("id", auditSubmission.id);

    try {
      const highLevel = await syncWholesaleRegistrationToHighLevel(registration);
      const { error: syncUpdateError } = await supabase.from("customers").update({
        ghl_contact_id: highLevel.contactId,
        ghl_sync_status: "synced",
        ghl_sync_error: null,
      }).eq("id", customer.id);
      if (syncUpdateError) throw new Error("El contacto se sincronizó, pero no se pudo guardar su estado local");
      if (auditSubmission) await supabase.from("form_submissions").update({
        status: "created",
        integration_status: "sent",
        completed_at: new Date().toISOString(),
      }).eq("id", auditSubmission.id);
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
      if (auditSubmission) await supabase.from("form_submissions").update({
        status: "created",
        integration_status: "failed",
        error_message: internalMessage.slice(0, 500),
        completed_at: new Date().toISOString(),
      }).eq("id", auditSubmission.id);
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
