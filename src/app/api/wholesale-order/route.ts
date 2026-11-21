import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { classifyHighLevelContact, sendHighLevelMessage, syncHighLevelOrderFields, syncWholesalePipeline } from "@/lib/orders/highlevel-pipeline";
import { wholesaleOrderConfirmationMessage } from "@/lib/orders/wholesale-messages";
import { safeUploadName, validateWholesalePortalOrder, wholesaleOrderText } from "@/lib/orders/wholesale-portal";
import { portalFingerprint, readWholesalePortalSession, sameOrigin, wholesalePortalCookie } from "@/lib/orders/wholesale-portal-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const proofTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const proofBucket = "wholesale-payment-proofs";

function deliveryTimestamp(date: string) {
  return `${date}T12:00:00-05:00`;
}

async function forwardPaymentProof(input: { orderId: number; orderNumber: string; customer: string; businessName: string; storagePath: string }) {
  const url = process.env.WHOLESALE_PAYMENT_WORKFLOW_URL?.trim();
  const secret = process.env.WHOLESALE_PAYMENT_WORKFLOW_SECRET?.trim();
  if (!url || !secret) return { ok: false as const, pending: true as const, message: "La automatización de comprobantes aún no está configurada." };
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(proofBucket).createSignedUrl(input.storagePath, 7 * 24 * 60 * 60);
  if (error || !data?.signedUrl) return { ok: false as const, pending: false as const, message: "No se pudo firmar el comprobante." };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-fenix-secret": secret },
      body: JSON.stringify({
        event: "wholesale.payment_proof.received",
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        customer: input.customer,
        businessName: input.businessName,
        paymentProofUrl: data.signedUrl,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false as const, pending: false as const, message: `La automatización respondió ${response.status}.` };
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, pending: false as const, message: error instanceof Error ? error.message : "No se pudo enviar el comprobante." };
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const session = readWholesalePortalSession(request.cookies.get(wholesalePortalCookie)?.value);
  if (!session) return NextResponse.json({ error: "Tu sesión venció. Verifica nuevamente tus datos." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 9_500_000) {
    return NextResponse.json({ error: "El formulario o comprobante es demasiado grande." }, { status: 413 });
  }

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "No pudimos leer el formulario." }, { status: 400 }); }
  let orderInput;
  try { orderInput = validateWholesalePortalOrder(JSON.parse(String(formData.get("order") ?? "{}"))); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Pedido inválido." }, { status: 422 }); }
  const proofValue = formData.get("paymentProof");
  const proof = proofValue instanceof File && proofValue.size > 0 ? proofValue : null;
  if (proof && (proof.size > 8 * 1024 * 1024 || !proofTypes.has(proof.type))) {
    return NextResponse.json({ error: "El comprobante debe ser JPG, PNG, WEBP o PDF y pesar máximo 8 MB." }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id,name,business_name,phone,tax_id,email,address,route_id,ghl_contact_id")
    .eq("id", session.customerId)
    .eq("customer_type", "wholesale")
    .eq("is_active", true)
    .not("wholesale_registered_at", "is", null)
    .single();
  if (customerError || !customer) return NextResponse.json({ error: "No pudimos encontrar tu registro mayorista." }, { status: 401 });

  const fingerprint = portalFingerprint(request, `customer:${customer.id}`);
  const submissionValues = {
    form_type: "wholesale_order",
    source: "system",
    idempotency_key: orderInput.idempotencyKey,
    customer_id: customer.id,
    status: "processing",
    integration_status: "pending",
    payment_proof_status: proof ? "received" : "none",
    client_fingerprint: fingerprint,
    payload: {
      requested_delivery_date: orderInput.requestedDeliveryDate,
      notes: orderInput.notes ?? null,
      item_count: orderInput.items.length,
      items: orderInput.items,
      has_payment_proof: Boolean(proof),
    },
  };
  const { data: submission, error: submissionError } = await supabase
    .from("form_submissions")
    .insert(submissionValues)
    .select("id")
    .single();
  if (submissionError?.code === "23505") {
    const { data: existing } = await supabase
      .from("form_submissions")
      .select("status,orders(order_number,status)")
      .eq("form_type", "wholesale_order")
      .eq("idempotency_key", orderInput.idempotencyKey)
      .maybeSingle();
    const existingOrder = Array.isArray(existing?.orders) ? existing?.orders[0] : existing?.orders;
    if (existingOrder) return NextResponse.json({ ok: true, duplicate: true, orderNumber: existingOrder.order_number, status: existingOrder.status });
    return NextResponse.json({ error: "Este envío todavía se está procesando. Espera unos segundos antes de intentar nuevamente." }, { status: 409 });
  }
  if (submissionError || !submission) return NextResponse.json({ error: "No pudimos iniciar el registro del formulario." }, { status: 500 });

  let storagePath: string | null = null;
  if (proof) {
    storagePath = `${customer.id}/${orderInput.requestedDeliveryDate}/${randomUUID()}-${safeUploadName(proof.name)}`;
    const { error: uploadError } = await supabase.storage.from(proofBucket).upload(storagePath, proof, { contentType: proof.type, upsert: false });
    if (uploadError) {
      await supabase.from("form_submissions").update({ status: "failed", payment_proof_status: "failed", error_message: "No se pudo guardar el comprobante." }).eq("id", submission.id);
      return NextResponse.json({ error: "No pudimos guardar el comprobante. El pedido no fue enviado; intenta nuevamente." }, { status: 500 });
    }
  }

  const orderText = wholesaleOrderText(orderInput.items);
  const sourcePayload = {
    source: "system-form",
    form_data: {
      form: "pedido-mayorista-sistema",
      order_text: orderText,
      tax_id: customer.tax_id,
      payment_proof_storage_path: storagePath,
      contact_id: customer.ghl_contact_id,
      original_payload: {
        submission_id: submission.id,
        requested_delivery_date: orderInput.requestedDeliveryDate,
        notes: orderInput.notes ?? null,
        items: orderInput.items,
      },
    },
  };
  const { data: createdRows, error: orderError } = await supabase.rpc("create_wholesale_portal_order", {
    p_submission_id: submission.id,
    p_customer_id: customer.id,
    p_source_reference: `system:wholesale-order:${orderInput.idempotencyKey}`,
    p_source_payload: sourcePayload,
    p_requested_delivery_at: deliveryTimestamp(orderInput.requestedDeliveryDate),
    p_notes: orderInput.notes ?? null,
    p_items: orderInput.items,
    p_payment_storage_path: storagePath,
    p_payment_mime_type: proof?.type ?? null,
  });
  const created = Array.isArray(createdRows) ? createdRows[0] : createdRows;
  if (orderError || !created) {
    if (storagePath) await supabase.storage.from(proofBucket).remove([storagePath]);
    await supabase.from("form_submissions").update({ status: "failed", error_message: "No se pudo crear el pedido." }).eq("id", submission.id);
    console.error("[wholesale-portal] Could not create order", { code: orderError?.code, message: orderError?.message, submissionId: submission.id });
    return NextResponse.json({ error: "No pudimos crear el pedido. No quedó registrado; intenta nuevamente." }, { status: 500 });
  }

  const context = { contactId: customer.ghl_contact_id ?? undefined };
  const [pipeline, fields, classification, confirmation, proofForward] = await Promise.all([
    syncWholesalePipeline(context, "order_placed", `${customer.name} · ${created.order_number}`, 0),
    syncHighLevelOrderFields(context, { orderNumber: created.order_number, total: 0 }),
    classifyHighLevelContact(context, "wholesale"),
    sendHighLevelMessage(context, wholesaleOrderConfirmationMessage({ customer: customer.name, orderNumber: created.order_number })),
    storagePath
      ? forwardPaymentProof({ orderId: created.order_id, orderNumber: created.order_number, customer: customer.name, businessName: customer.business_name || customer.name, storagePath })
      : Promise.resolve({ ok: true as const }),
  ]);
  const orderIntegrationOk = pipeline.ok && fields.ok && classification.ok && confirmation.ok;
  const integrationOk = orderIntegrationOk && proofForward.ok;
  const proofPending = !proofForward.ok && "pending" in proofForward && proofForward.pending;
  const integrationErrors = [pipeline, fields, classification, confirmation, proofForward]
    .filter((result) => !result.ok && !("skipped" in result && result.skipped))
    .map((result) => "message" in result ? result.message : "Integración pendiente")
    .filter(Boolean)
    .join(" · ")
    .slice(0, 1_000);
  await supabase.from("form_submissions").update({
    integration_status: integrationOk ? "sent" : proofPending && orderIntegrationOk ? "pending" : "failed",
    payment_proof_status: storagePath ? proofForward.ok ? "forwarded" : proofPending ? "received" : "failed" : "none",
    error_message: integrationErrors || null,
  }).eq("id", submission.id);
  const { data: outboxEvents } = await supabase.from("integration_outbox").select("id,event_type").eq("aggregate_id", String(created.order_id));
  for (const event of outboxEvents ?? []) {
    const sent = event.event_type === "wholesale.order.created" ? orderIntegrationOk : proofForward.ok;
    const pending = event.event_type === "wholesale.payment_proof.received" && proofPending;
    await supabase.from("integration_outbox").update({
      status: sent ? "sent" : pending ? "pending" : "failed",
      attempts: pending ? 0 : 1,
      sent_at: sent ? new Date().toISOString() : null,
      last_error: sent ? null : integrationErrors || "Integración pendiente",
      next_attempt_at: sent ? new Date().toISOString() : new Date(Date.now() + 5 * 60_000).toISOString(),
    }).eq("id", event.id);
  }

  return NextResponse.json({
    ok: true,
    orderNumber: created.order_number,
    status: created.order_status,
    paymentProofReceived: Boolean(storagePath),
    integrationsPending: !integrationOk,
  }, { status: 201 });
}

