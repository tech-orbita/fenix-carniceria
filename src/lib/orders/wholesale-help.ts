import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { syncWholesalePipeline } from "@/lib/orders/highlevel-pipeline";
import { normalizeWholesaleHelpPayload } from "@/lib/orders/wholesale-help-payload";
import { customerIdentityKey } from "@/lib/orders/wholesale-routes";
import { createAdminClient } from "@/lib/supabase/admin";

export function authorizedWholesaleHelp(request: NextRequest) {
  const configured = process.env.WHOLESALE_ORDERS_INGEST_SECRET || process.env.ORDERS_INGEST_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function flagWholesaleHelpRequest(value: unknown) {
  const normalized = normalizeWholesaleHelpPayload(value);
  if (!normalized.ok) return NextResponse.json({ error: normalized.error }, { status: 422 });
  const body = normalized.data;
  const supabase = createAdminClient();
  const sourceReference = body.sourceEventId ? `ghl:wholesale-help:${body.sourceEventId}` : null;
  const identityKey = customerIdentityKey("wholesale", {
    businessName: body.customer.businessName,
    name: body.customer.name,
    phone: body.customer.phone,
  });

  if (sourceReference) {
    const { data: duplicate, error: duplicateError } = await supabase
      .from("orders")
      .select("id,order_number")
      .eq("source", "agent")
      .eq("source_reference", sourceReference)
      .maybeSingle();
    if (duplicateError) return NextResponse.json({ error: "Could not verify duplicate wholesale help request" }, { status: 500 });
    if (duplicate) return NextResponse.json({ ok: true, ...duplicate, adjusted: false, duplicate: true });
  }

  const { data: existingCustomer, error: lookupError } = await supabase
    .from("customers")
    .select("id,name,business_name,address,neighborhood,city,route_id")
    .eq("customer_type", "wholesale")
    .eq("identity_key", identityKey)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not find wholesale customer" }, { status: 500 });

  const customerValues = {
    name: existingCustomer && body.customer.name === "Cliente WhatsApp" ? existingCustomer.name : body.customer.name,
    business_name: body.customer.businessName ?? existingCustomer?.business_name ?? null,
    address: body.customer.address ?? existingCustomer?.address ?? null,
    neighborhood: body.customer.neighborhood ?? existingCustomer?.neighborhood ?? null,
    city: body.customer.city ?? existingCustomer?.city ?? "Barranquilla",
  };
  const customerResult = existingCustomer
    ? await supabase.from("customers").update(customerValues).eq("id", existingCustomer.id).select("id,name,business_name,address,route_id").single()
    : await supabase.from("customers").insert({ customer_type: "wholesale", identity_key: identityKey, phone: body.customer.phone, ...customerValues }).select("id,name,business_name,address,route_id").single();
  if (customerResult.error || !customerResult.data) return NextResponse.json({ error: "Could not save wholesale customer" }, { status: 500 });
  const customer = customerResult.data;

  const sourcePayload = {
    source: "agent",
    locationId: body.locationId ?? null,
    contactId: body.contactId ?? null,
    conversationId: body.conversationId ?? null,
    conversationUrl: body.conversationUrl ?? null,
    sourceEventId: body.sourceEventId ?? null,
    helpReason: body.reason,
    helpWithoutForm: true,
  };
  // La solicitud de ayuda siempre vive en una fila independiente y sin
  // productos. Así aparece en la bandeja Requiere ayuda aunque el cliente ya
  // tenga un pedido operativo, y ese pedido permanece intacto en Pedidos.
  const result = await supabase.from("orders").insert({
    customer_type: "wholesale",
    customer_id: customer.id,
    route_id: customer.route_id,
    source: "agent",
    source_reference: sourceReference,
    source_payload: sourcePayload,
    status: "incident",
    fulfillment_type: "delivery",
    delivery_address: customer.address,
    notes: body.reason,
  }).select("id,order_number,total").single();
  if (result.error || !result.data) return NextResponse.json({ error: "Could not register wholesale help request" }, { status: 500 });

  const pipeline = await syncWholesalePipeline(
    {
      contactId: typeof sourcePayload.contactId === "string" ? sourcePayload.contactId : undefined,
      locationId: typeof sourcePayload.locationId === "string" ? sourcePayload.locationId : undefined,
      conversationId: typeof sourcePayload.conversationId === "string" ? sourcePayload.conversationId : undefined,
    },
    "help",
    `${customer.name} · ${result.data.order_number}`,
    Number(result.data.total ?? 0),
  );
  return NextResponse.json({
    ok: true,
    id: result.data.id,
    order_number: result.data.order_number,
    adjusted: false,
    duplicate: false,
    pipeline_synced: pipeline.ok,
    pipeline_message: pipeline.ok ? undefined : pipeline.message,
  }, { status: 201 });
}
