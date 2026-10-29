import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { syncRetailPipeline } from "@/lib/orders/highlevel-pipeline";
import { normalizeRetailItems, requiresRetailHelp } from "@/lib/orders/retail-normalization";
import type { RetailCatalogProduct, RetailInputItem } from "@/lib/orders/retail-normalization";
import { retailOrderWindowStart } from "@/lib/orders/retail-order-window";

type RetailAgentItem = RetailInputItem;

type RetailAgentPayload = {
  locationId?: string;
  contactId?: string;
  conversationId?: string;
  contextUntil?: string;
  sourceEventId?: string;
  confidence?: number;
  orderAction?: "new" | "update";
  rawOrderText?: string;
  notes?: string;
  customer?: {
    name?: string;
    phone?: string;
    document?: string;
    address?: string;
    neighborhood?: string;
    city?: string;
  };
  delivery?: { type?: "domicilio" | "recogida"; address?: string };
  paymentMethod?: string;
  items?: RetailAgentItem[];
};

type RetailHelpPayload = {
  locationId?: string;
  contactId?: string;
  conversationId?: string;
  sourceEventId?: string;
  reason?: string;
  customer?: { name?: string; phone?: string };
};

export function authorizedRetail(request: NextRequest) {
  const configured = process.env.RETAIL_ORDERS_INGEST_SECRET || process.env.ORDERS_INGEST_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function cleanPhone(value?: string) {
  return String(value ?? "").replace(/[^\d+]/g, "").trim();
}

function paymentMethod(value?: string): "cash" | "transfer" | "credit" | "other" | null {
  const normalized = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!normalized) return null;
  if (/efectivo|contraentrega/.test(normalized)) return "cash";
  if (/transfer|nequi|daviplata|bancolombia/.test(normalized)) return "transfer";
  if (/credito|fiado/.test(normalized)) return "credit";
  return "other";
}

async function retailCatalog(): Promise<RetailCatalogProduct[]> {
  const supabase = createAdminClient();
  const [{ data: products, error: productError }, { data: prices, error: priceError }] = await Promise.all([
    supabase.from("products").select("id,name,catalog_key").eq("active", true),
    supabase.from("product_prices").select("product_id,amount").eq("segment", "minorista").eq("unit", "kilo").is("valid_until", null),
  ]);
  if (productError || priceError) {
    console.error("[retail-order] Could not load retail catalog", { productError, priceError });
    return [];
  }
  const amounts = new Map((prices ?? []).map((price) => [String(price.product_id), Number(price.amount)]));
  return (products ?? []).flatMap((product) => {
    const pricePerKg = amounts.get(String(product.id));
    return Number.isFinite(pricePerKg)
      ? [{ id: String(product.id), name: String(product.name), catalogKey: String(product.catalog_key), pricePerKg: pricePerKg! }]
      : [];
  });
}

async function findCustomerId(phone: string) {
  if (!phone) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("customer_type", "retail")
    .eq("phone", phone)
    .maybeSingle();
  return data?.id ?? null;
}

async function findLatestOrder(customerId: number, from?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("orders")
    .select("id,order_number,status,source_payload,received_at")
    .eq("customer_type", "retail")
    .eq("customer_id", customerId)
    .order("received_at", { ascending: false })
    .limit(1);
  if (from) query = query.gte("received_at", from);
  const { data } = await query.maybeSingle();
  return data;
}

async function findLatestOrderByContactId(contactId: string, from?: string) {
  if (!contactId) return null;
  const supabase = createAdminClient();
  let query = supabase
    .from("orders")
    .select("id,order_number,status,source_payload,received_at")
    .eq("customer_type", "retail")
    .eq("source_payload->>contactId", contactId)
    .order("received_at", { ascending: false })
    .limit(1);
  if (from) query = query.gte("received_at", from);
  const { data } = await query.maybeSingle();
  return data;
}

function findCurrentOrder(customerId: number) {
  return findLatestOrder(customerId, retailOrderWindowStart());
}

export async function retailOrderContext(value: unknown) {
  const body = value && typeof value === "object" ? value as RetailAgentPayload : {};
  const phone = cleanPhone(body.customer?.phone);
  const customerId = await findCustomerId(phone);
  const cutoff = retailOrderWindowStart();
  const [currentByCustomer, latestByCustomer] = customerId
    ? await Promise.all([findLatestOrder(customerId, cutoff), findLatestOrder(customerId)])
    : [null, null];
  const [currentOrder, latestOrder] = await Promise.all([
    currentByCustomer ?? findLatestOrderByContactId(String(body.contactId ?? "").trim(), cutoff),
    latestByCustomer ?? findLatestOrderByContactId(String(body.contactId ?? "").trim()),
  ]);
  const currentSource = (currentOrder?.source_payload ?? {}) as Record<string, unknown>;
  const latestSource = (latestOrder?.source_payload ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    openOrder: currentOrder ? {
      id: currentOrder.id,
      number: currentOrder.order_number,
      status: currentOrder.status,
      inPreparation: currentOrder.status === "preparing",
      text: typeof currentSource.rawOrderText === "string" ? currentSource.rawOrderText : "",
    } : null,
    // Aunque el pedido anterior esté cerrado o sea de otra ventana, n8n debe
    // empezar después del último mensaje ya procesado para no copiarlo al nuevo.
    since: typeof currentSource.contextUntil === "string"
      ? currentSource.contextUntil
      : typeof latestSource.contextUntil === "string" ? latestSource.contextUntil : null,
    cutoff,
  });
}

export async function upsertRetailOrder(value: unknown) {
  if (!value || typeof value !== "object") {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 422 });
  }
  const body = value as RetailAgentPayload;
  const phone = cleanPhone(body.customer?.phone);
  const items = normalizeRetailItems(
    Array.isArray(body.items) ? body.items : [],
    String(body.rawOrderText ?? ""),
    await retailCatalog(),
  );
  if (!phone || !items.length || !String(body.rawOrderText ?? "").trim()) {
    return NextResponse.json({ error: "Phone, order text and at least one item are required" }, { status: 422 });
  }

  const supabase = createAdminClient();
  const existingCustomerId = await findCustomerId(phone);
  const { data: existingCustomer } = existingCustomerId
    ? await supabase.from("customers").select("name,tax_id,address,neighborhood,city,route_id").eq("id", existingCustomerId).single()
    : { data: null };
  const name = String(body.customer?.name ?? existingCustomer?.name ?? "Cliente WhatsApp").trim();
  const address = String(body.delivery?.address ?? body.customer?.address ?? existingCustomer?.address ?? "").trim();
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert({
      customer_type: "retail",
      name,
      phone,
      tax_id: String(body.customer?.document ?? existingCustomer?.tax_id ?? "").trim() || null,
      address: address || null,
      neighborhood: String(body.customer?.neighborhood ?? existingCustomer?.neighborhood ?? "").trim() || null,
      city: String(body.customer?.city ?? existingCustomer?.city ?? "Barranquilla").trim(),
      route_id: existingCustomer?.route_id ?? null,
    }, { onConflict: "customer_type,phone" })
    .select("id")
    .single();
  if (customerError || !customer) return NextResponse.json({ error: "Could not save customer" }, { status: 500 });

  // "new" siempre crea otro pedido. "update" solo puede tocar el pedido de la
  // ventana operativa vigente; después de las 2 p. m. se inicia otra ventana.
  const openOrder = body.orderAction === "new" ? null : await findCurrentOrder(customer.id);
  const previousPayload = openOrder?.source_payload && typeof openOrder.source_payload === "object"
    ? openOrder.source_payload as Record<string, unknown>
    : {};
  const sourcePayload = {
    ...previousPayload,
    source: "agent",
    locationId: body.locationId ?? null,
    contactId: body.contactId ?? null,
    conversationId: body.conversationId ?? null,
    contextUntil: body.contextUntil ?? null,
    rawOrderText: String(body.rawOrderText).trim(),
    sourceEventId: body.sourceEventId ?? null,
    orderAction: body.orderAction ?? null,
    orderWindowStart: retailOrderWindowStart(),
  };
  // Las piezas conservan la cantidad solicitada, pero no se cobran como si
  // fueran kilos. El subtotal queda pendiente hasta registrar el peso real.
  const subtotal = items.reduce((total, item) => total + (item.unit === "kg" ? item.quantity * item.unit_price : 0), 0);

  if (openOrder) {
    const { error: updateError } = await supabase.from("orders").update({
      source_payload: sourcePayload,
      extraction_confidence: body.confidence ?? null,
      fulfillment_type: body.delivery?.type === "recogida" ? "pickup" : "delivery",
      delivery_address: address || null,
      payment_method: paymentMethod(body.paymentMethod),
      notes: String(body.notes ?? "").trim() || null,
      subtotal,
    }).eq("id", openOrder.id);
    if (updateError) return NextResponse.json({ error: "Could not update order" }, { status: 500 });

    const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", openOrder.id);
    if (deleteError) return NextResponse.json({ error: "Could not replace order items" }, { status: 500 });
    const { error: itemsError } = await supabase.from("order_items").insert(items.map((item, sort_order) => ({ ...item, order_id: openOrder.id, sort_order })));
    if (itemsError) return NextResponse.json({ error: "Could not save order items" }, { status: 500 });
    return NextResponse.json({ id: openOrder.id, order_number: openOrder.order_number, status: openOrder.status, adjusted: true });
  }

  const sourceReference = body.sourceEventId ? `ghl:retail:${body.sourceEventId}` : null;
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    customer_type: "retail",
    customer_id: customer.id,
    route_id: existingCustomer?.route_id ?? null,
    source: "agent",
    source_reference: sourceReference,
    source_payload: sourcePayload,
    extraction_confidence: body.confidence ?? null,
    status: "received",
    fulfillment_type: body.delivery?.type === "recogida" ? "pickup" : "delivery",
    delivery_address: address || null,
    payment_method: paymentMethod(body.paymentMethod),
    subtotal,
    notes: String(body.notes ?? "").trim() || null,
  }).select("id,order_number,status").single();
  if (orderError || !order) {
    if (orderError?.code === "23505" && sourceReference) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id,order_number,status")
        .eq("source", "agent")
        .eq("source_reference", sourceReference)
        .maybeSingle();
      if (existingOrder) {
        return NextResponse.json({ ...existingOrder, adjusted: false, duplicate: true });
      }
    }
    return NextResponse.json({ error: "Could not save order" }, { status: 500 });
  }
  const { error: itemsError } = await supabase.from("order_items").insert(items.map((item, sort_order) => ({ ...item, order_id: order.id, sort_order })));
  if (itemsError) {
    console.error("[retail-order] Could not save order items", {
      code: itemsError.code,
      message: itemsError.message,
      details: itemsError.details,
      hint: itemsError.hint,
      orderId: order.id,
    });
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Could not save order items" }, { status: 500 });
  }
  const pipeline = await syncRetailPipeline(
    { contactId: body.contactId, locationId: body.locationId, conversationId: body.conversationId },
    "order_placed",
    `${name} · ${order.order_number}`,
    subtotal,
  );
  return NextResponse.json({ ...order, adjusted: false, duplicate: false, pipeline_synced: pipeline.ok, pipeline_message: pipeline.ok ? undefined : pipeline.message }, { status: 201 });
}

export async function flagRetailHelpRequest(value: unknown) {
  if (!value || typeof value !== "object") return NextResponse.json({ error: "Invalid help payload" }, { status: 422 });
  const body = value as RetailHelpPayload;
  const phone = cleanPhone(body.customer?.phone);
  const reason = String(body.reason ?? "El cliente requiere atención humana.").trim().slice(0, 2_000);
  if (!phone || !reason) return NextResponse.json({ error: "Phone and reason are required" }, { status: 422 });
  // Fallos de OCR, extracción o integración no son solicitudes del cliente y
  // no deben sacar un pedido de Nuevos para enviarlo a Requiere ayuda.
  if (!requiresRetailHelp(reason)) {
    return NextResponse.json({ ok: true, ignored: true, reason: "No customer clarification or advisor request was detected." });
  }

  const supabase = createAdminClient();
  const { data: customer, error: customerError } = await supabase.from("customers").upsert({
    customer_type: "retail",
    name: String(body.customer?.name ?? "Cliente WhatsApp").trim() || "Cliente WhatsApp",
    phone,
  }, { onConflict: "customer_type,phone" }).select("id,name").single();
  if (customerError || !customer) return NextResponse.json({ error: "Could not save customer" }, { status: 500 });

  const openOrder = await findCurrentOrder(customer.id);
  const sourcePayload = {
    source: "agent",
    locationId: body.locationId ?? null,
    contactId: body.contactId ?? null,
    conversationId: body.conversationId ?? null,
    sourceEventId: body.sourceEventId ?? null,
    helpReason: reason,
  };
  const result = openOrder
    ? await supabase.from("orders").update({ status: "incident", notes: reason, source_payload: sourcePayload }).eq("id", openOrder.id).select("id,order_number").single()
    : await supabase.from("orders").insert({
        customer_type: "retail",
        customer_id: customer.id,
        source: "agent",
        source_reference: body.sourceEventId ? `ghl:retail-help:${body.sourceEventId}` : null,
        source_payload: sourcePayload,
        status: "incident",
        fulfillment_type: "delivery",
        notes: reason,
      }).select("id,order_number").single();
  if (result.error || !result.data) return NextResponse.json({ error: "Could not register help request" }, { status: 500 });

  const pipeline = await syncRetailPipeline(
    { contactId: body.contactId, locationId: body.locationId, conversationId: body.conversationId },
    "help",
    `${customer.name} · ${result.data.order_number}`,
    0,
  );
  return NextResponse.json({
    ok: true,
    id: result.data.id,
    order_number: result.data.order_number,
    adjusted: Boolean(openOrder),
    pipeline_synced: pipeline.ok,
    pipeline_message: pipeline.ok ? undefined : pipeline.message,
  }, { status: openOrder ? 200 : 201 });
}
