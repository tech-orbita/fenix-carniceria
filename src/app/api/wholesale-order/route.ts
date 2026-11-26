import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { classifyHighLevelContact, sendHighLevelMessage, syncHighLevelOrderFields, syncWholesalePipeline } from "@/lib/orders/highlevel-pipeline";
import { wholesaleOrderConfirmationMessage } from "@/lib/orders/wholesale-messages";
import { parseOrderTextDetailed } from "@/lib/orders/product-parser";
import { selectedWholesaleCustomer } from "@/lib/orders/wholesale-customer-lookup";
import { validateWholesalePortalOrder } from "@/lib/orders/wholesale-portal";
import { normalizedWholesaleBusiness, normalizedWholesalePhone } from "@/lib/orders/wholesale-routes";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try { return new URL(origin).host === expectedHost; }
  catch { return false; }
}

function requestFingerprint(request: Request, identity: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`${ip}:${identity}`).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 30_000) {
    return NextResponse.json({ error: "El formulario es demasiado grande." }, { status: 413 });
  }

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "No pudimos leer el formulario." }, { status: 400 }); }

  let orderInput;
  try { orderInput = validateWholesalePortalOrder(raw); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pedido inválido." }, { status: 422 });
  }

  const parsed = parseOrderTextDetailed(orderInput.orderText);
  if (!parsed.items.length || parsed.items.length > 50) {
    return NextResponse.json({ error: "No pudimos reconocer productos. Escribe un producto y su cantidad en cada renglón." }, { status: 422 });
  }

  const normalizedPhone = normalizedWholesalePhone(orderInput.phone);
  const normalizedBusiness = normalizedWholesaleBusiness(orderInput.businessName);
  const fingerprint = requestFingerprint(request, `${normalizedBusiness}:${normalizedPhone}`);
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count: recentAttempts, error: attemptLookupError } = await supabase
    .from("wholesale_portal_access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("client_fingerprint", fingerprint)
    .gte("attempted_at", cutoff);
  if (attemptLookupError) return NextResponse.json({ error: "No pudimos validar el envío. Intenta nuevamente." }, { status: 500 });
  if ((recentAttempts ?? 0) >= 12) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos antes de volver a intentar." }, { status: 429 });
  }
  await supabase.from("wholesale_portal_access_attempts").insert({ client_fingerprint: fingerprint, succeeded: false });

  const { data: submission, error: submissionError } = await supabase.from("form_submissions").insert({
    form_type: "wholesale_order",
    source: "system",
    idempotency_key: orderInput.idempotencyKey,
    status: "processing",
    integration_status: "pending",
    client_fingerprint: fingerprint,
    payload: {
      business_name: orderInput.businessName,
      phone: orderInput.phone,
      order_text: orderInput.orderText,
      notes: orderInput.notes ?? null,
      parsed_items: parsed.items,
      unresolved: parsed.unresolved,
    },
  }).select("id").single();
  if (submissionError?.code === "23505") {
    const { data: existing } = await supabase.from("form_submissions")
      .select("status,order_id")
      .eq("form_type", "wholesale_order")
      .eq("idempotency_key", orderInput.idempotencyKey)
      .maybeSingle();
    if (existing?.order_id) {
      const { data: existingOrder } = await supabase.from("orders").select("order_number,status").eq("id", existing.order_id).maybeSingle();
      if (existingOrder) return NextResponse.json({ ok: true, duplicate: true, orderNumber: existingOrder.order_number, status: existingOrder.status });
    }
    return NextResponse.json({ error: "Este envío todavía se está procesando. Espera unos segundos antes de intentar nuevamente." }, { status: 409 });
  }
  if (submissionError || !submission) return NextResponse.json({ error: "No pudimos registrar la recepción del formulario." }, { status: 500 });

  const { data: candidates, error: customerError } = await supabase.from("customers")
    .select("id,name,business_name,phone,tax_id,address,route_id,ghl_contact_id")
    .eq("customer_type", "wholesale")
    .eq("is_active", true)
    .not("wholesale_registered_at", "is", null);
  if (customerError) {
    await supabase.from("form_submissions").update({ status: "failed", error_message: "No se pudo consultar el registro de clientes.", completed_at: new Date().toISOString() }).eq("id", submission.id);
    return NextResponse.json({ error: "No pudimos verificar tu registro. Intenta nuevamente." }, { status: 500 });
  }
  const customer = selectedWholesaleCustomer(candidates ?? [], {
    phone: orderInput.phone,
    customerId: orderInput.customerId,
    businessName: orderInput.businessName,
  });
  if (!customer) {
    await supabase.from("form_submissions").update({
      status: "needs_review",
      integration_status: "not_required",
      error_message: "Cliente mayorista no registrado o establecimiento no seleccionado.",
      completed_at: new Date().toISOString(),
    }).eq("id", submission.id);
    return NextResponse.json({
      error: "No pudimos confirmar el establecimiento para ese teléfono. Comprueba el número o regístrate antes de enviar el pedido.",
      registrationRequired: true,
      registrationUrl: "/registro-mayorista",
    }, { status: 404 });
  }

  const needsReview = parsed.unresolved.length > 0 || parsed.items.some((item) => item.quantity <= 0);
  const sourcePayload = {
    source: "system-form",
    form_data: {
      form: "pedido-mayorista-sistema",
      order_text: orderInput.orderText,
      tax_id: customer.tax_id,
      contact_id: customer.ghl_contact_id,
      original_payload: {
        submission_id: submission.id,
        business_name: orderInput.businessName,
        phone: orderInput.phone,
        notes: orderInput.notes ?? null,
        unresolved: parsed.unresolved,
      },
    },
  };
  const { data: createdRows, error: orderError } = await supabase.rpc("create_wholesale_form_order", {
    p_submission_id: submission.id,
    p_customer_id: customer.id,
    p_source_reference: `system:wholesale-order:${orderInput.idempotencyKey}`,
    p_source_payload: sourcePayload,
    p_status: needsReview ? "needs_review" : "received",
    p_notes: orderInput.notes ?? null,
    p_items: parsed.items,
  });
  const created = Array.isArray(createdRows) ? createdRows[0] : createdRows;
  if (orderError || !created) {
    await supabase.from("form_submissions").update({ status: "failed", error_message: "No se pudo crear el pedido.", completed_at: new Date().toISOString() }).eq("id", submission.id);
    console.error("[wholesale-order-form] Could not create order", { code: orderError?.code, message: orderError?.message, submissionId: submission.id });
    return NextResponse.json({ error: "Recibimos el formulario, pero no pudimos crear el pedido. El equipo podrá revisarlo; no lo envíes repetidamente." }, { status: 500 });
  }

  await supabase.from("wholesale_portal_access_attempts").update({ succeeded: true }).eq("client_fingerprint", fingerprint).eq("succeeded", false);
  const context = { contactId: customer.ghl_contact_id ?? undefined };
  const [pipeline, fields, classification, confirmation] = await Promise.all([
    syncWholesalePipeline(context, "order_placed", `${customer.name} · ${created.order_number}`, 0),
    syncHighLevelOrderFields(context, { orderNumber: created.order_number, total: 0 }),
    classifyHighLevelContact(context, "wholesale"),
    sendHighLevelMessage(context, wholesaleOrderConfirmationMessage({ customer: customer.name, orderNumber: created.order_number })),
  ]);
  const integrations = [pipeline, fields, classification, confirmation];
  const integrationOk = integrations.every((result) => result.ok || ("skipped" in result && result.skipped));
  const integrationErrors = integrations
    .filter((result) => !result.ok && !("skipped" in result && result.skipped))
    .map((result) => "message" in result ? result.message : "Integración pendiente")
    .filter(Boolean)
    .join(" · ")
    .slice(0, 1_000);
  await Promise.all([
    supabase.from("form_submissions").update({
      integration_status: integrationOk ? "sent" : "failed",
      error_message: integrationErrors || null,
    }).eq("id", submission.id),
    supabase.from("integration_outbox").update({
      status: integrationOk ? "sent" : "failed",
      attempts: 1,
      sent_at: integrationOk ? new Date().toISOString() : null,
      last_error: integrationErrors || null,
      next_attempt_at: integrationOk ? new Date().toISOString() : new Date(Date.now() + 5 * 60_000).toISOString(),
    }).eq("event_type", "wholesale.order.created").eq("aggregate_id", String(created.order_id)),
  ]);

  return NextResponse.json({
    ok: true,
    orderNumber: created.order_number,
    status: created.order_status,
    needsReview,
    integrationsPending: !integrationOk,
  }, { status: 201 });
}
