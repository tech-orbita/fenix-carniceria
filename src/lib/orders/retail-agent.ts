import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { syncRetailPipeline } from "@/lib/orders/highlevel-pipeline";
import { normalizeRetailItems, requiresRetailHelp } from "@/lib/orders/retail-normalization";
import type { RetailCatalogProduct, RetailInputItem } from "@/lib/orders/retail-normalization";

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

const OPEN_STATUSES = ["needs_review", "received", "quoted", "confirmed", "preparing", "incident"];

export function authorizedRetail(request: NextRequest) {
  const configured = process.env.RETAIL_ORDERS_INGEST_SECRET || process.env.ORDERS_INGEST_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function bogotaDayStart() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const day = formatter.format(new Date());
  return new Date(`${day}T00:00:00-05:00`).toISOString();
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

async function findOpenOrder(customerId: number) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("id,order_number,status,source_payload,received_at")
    .eq("customer_type", "retail")
    .eq("customer_id", customerId)
    .in("status", OPEN_STATUSES)
    .gte("received_at", bogotaDayStart())
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function retailOrderContext(value: unknown) {
  const body = value && typeof value === "object" ? value as RetailAgentPayload : {};
  const phone = cleanPhone(body.customer?.phone);
  const customerId = await findCustomerId(phone);
  if (!customerId) return NextResponse.json({ openOrder: null, since: null });

  const openOrder = await findOpenOrder(customerId);
  if (!openOrder) return NextResponse.json({ openOrder: null, since: null });
  const source = (openOrder.source_payload ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    openOrder: {
      id: openOrder.id,
      number: openOrder.order_number,
      status: openOrder.status,
      inPreparation: openOrder.status === "preparing",
      text: typeof source.rawOrderText === "string" ? source.rawOrderText : "",
    },
    since: typeof source.contextUntil === "string" ? source.contextUntil : null,
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

  const openOrder = body.orderAction === "new" ? null : await findOpenOrder(customer.id);
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
  };
  const subtotal = items.reduce((total, item) => total + item.quantity * item.unit_price, 0);

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
    return NextResponse.json({ error: orderError?.code === "23505" ? "Order already received" : "Could not save order" }, { status: orderError?.code === "23505" ? 409 : 500 });
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
  return NextResponse.json({ ...order, adjusted: false, pipeline_synced: pipeline.ok, pipeline_message: pipeline.ok ? undefined : pipeline.message }, { status: 201 });
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

  const openOrder = await findOpenOrder(customer.id);
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
