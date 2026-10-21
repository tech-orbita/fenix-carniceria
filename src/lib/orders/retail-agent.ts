import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type RetailAgentItem = {
  product_name?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  preparation?: string;
  notes?: string;
  rawText?: string;
};

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

const OPEN_STATUSES = ["needs_review", "received", "quoted", "confirmed", "preparing"];

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

function normalizeItems(payload: RetailAgentPayload) {
  const supplied = Array.isArray(payload.items) ? payload.items : [];
  const fallback: RetailAgentItem[] = String(payload.rawOrderText ?? "")
    .split(/\r?\n|;+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .map((rawText) => ({ rawText }));

  return (supplied.length ? supplied : fallback).slice(0, 100).map((item) => {
    const rawText = String(item.rawText ?? "").trim();
    const productName = String(item.product_name ?? item.name ?? rawText).trim().slice(0, 180);
    const quantity = Number(item.quantity ?? 1);
    return {
      product_name: productName,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unit: String(item.unit ?? "solicitud").trim().slice(0, 40) || "solicitud",
      preparation: String(item.preparation ?? "").trim().slice(0, 250) || null,
      notes: String(item.notes ?? (rawText && rawText !== productName ? rawText : "")).trim().slice(0, 500) || null,
      unit_price: 0,
    };
  }).filter((item) => item.product_name);
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
  const items = normalizeItems(body);
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
  const sourcePayload = {
    source: "agent",
    locationId: body.locationId ?? null,
    contactId: body.contactId ?? null,
    conversationId: body.conversationId ?? null,
    contextUntil: body.contextUntil ?? null,
    rawOrderText: String(body.rawOrderText).trim(),
    sourceEventId: body.sourceEventId ?? null,
  };

  if (openOrder) {
    const { error: updateError } = await supabase.from("orders").update({
      source_payload: sourcePayload,
      extraction_confidence: body.confidence ?? null,
      fulfillment_type: body.delivery?.type === "recogida" ? "pickup" : "delivery",
      delivery_address: address || null,
      payment_method: paymentMethod(body.paymentMethod),
      notes: String(body.notes ?? "").trim() || null,
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
    status: body.confidence != null && body.confidence >= 0.9 ? "received" : "needs_review",
    fulfillment_type: body.delivery?.type === "recogida" ? "pickup" : "delivery",
    delivery_address: address || null,
    payment_method: paymentMethod(body.paymentMethod),
    notes: String(body.notes ?? "").trim() || null,
  }).select("id,order_number,status").single();
  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.code === "23505" ? "Order already received" : "Could not save order" }, { status: orderError?.code === "23505" ? 409 : 500 });
  }
  const { error: itemsError } = await supabase.from("order_items").insert(items.map((item, sort_order) => ({ ...item, order_id: order.id, sort_order })));
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Could not save order items" }, { status: 500 });
  }
  return NextResponse.json({ ...order, adjusted: false }, { status: 201 });
}
