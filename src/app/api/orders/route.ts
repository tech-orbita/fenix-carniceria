import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type IngestItem = {
  product_name: string;
  quantity: number;
  unit: string;
  preparation?: string;
  notes?: string;
  unit_price?: number;
};

type IngestBody = {
  source: "form" | "agent";
  source_reference?: string;
  confidence?: number;
  customer_type: "retail" | "wholesale";
  customer: {
    name: string;
    phone: string;
    business_name?: string;
    tax_id?: string;
    email?: string;
    address?: string;
    neighborhood?: string;
    city?: string;
  };
  route?: string;
  fulfillment_type?: "delivery" | "pickup";
  requested_delivery_at?: string;
  delivery_address?: string;
  delivery_notes?: string;
  payment_method?: "cash" | "transfer" | "credit" | "other";
  notes?: string;
  items: IngestItem[];
};

function authorized(request: NextRequest) {
  const configured = process.env.ORDERS_INGEST_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;

  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isValidBody(value: unknown): value is IngestBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<IngestBody>;
  return (
    (body.source === "form" || body.source === "agent") &&
    (body.customer_type === "retail" || body.customer_type === "wholesale") &&
    Boolean(body.customer?.name?.trim()) &&
    Boolean(body.customer?.phone?.trim()) &&
    Array.isArray(body.items) &&
    body.items.length > 0 &&
    body.items.every((item) =>
      Boolean(item?.product_name?.trim()) &&
      Number.isFinite(item?.quantity) &&
      Number(item.quantity) > 0 &&
      Boolean(item?.unit?.trim()),
    )
  );
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 422 });
  }

  const supabase = createAdminClient();
  const routeName = body.route?.trim() || "Sin clasificar";
  const { data: route } = await supabase.from("routes").select("id").eq("name", routeName).maybeSingle();
  const { data: fallbackRoute } = route
    ? { data: null }
    : await supabase.from("routes").select("id").eq("name", "Sin clasificar").single();
  const routeId = route?.id ?? fallbackRoute?.id ?? null;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert({
      customer_type: body.customer_type,
      name: body.customer.name.trim(),
      phone: body.customer.phone.trim(),
      business_name: body.customer.business_name?.trim() || null,
      tax_id: body.customer.tax_id?.trim() || null,
      email: body.customer.email?.trim() || null,
      address: body.customer.address?.trim() || null,
      neighborhood: body.customer.neighborhood?.trim() || null,
      city: body.customer.city?.trim() || "Barranquilla",
      route_id: routeId,
    }, { onConflict: "customer_type,phone" })
    .select("id")
    .single();

  if (customerError || !customer) {
    return NextResponse.json({ error: "Could not save customer" }, { status: 500 });
  }

  const subtotal = body.items.reduce(
    (total, item) => total + Number(item.quantity) * Number(item.unit_price ?? 0),
    0,
  );
  const needsReview = body.source === "agent" && (body.confidence == null || body.confidence < 0.9);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_type: body.customer_type,
      customer_id: customer.id,
      route_id: routeId,
      source: body.source,
      source_reference: body.source_reference ?? null,
      source_payload: body,
      extraction_confidence: body.confidence ?? null,
      status: needsReview ? "needs_review" : "received",
      fulfillment_type: body.fulfillment_type ?? "delivery",
      requested_delivery_at: body.requested_delivery_at ?? null,
      delivery_address: body.delivery_address ?? body.customer.address ?? null,
      delivery_notes: body.delivery_notes ?? null,
      payment_method: body.payment_method ?? null,
      subtotal,
      notes: body.notes ?? null,
    })
    .select("id, order_number, status")
    .single();

  if (orderError || !order) {
    const status = orderError?.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "Order already received" : "Could not save order" }, { status });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    body.items.map((item, index) => ({
      order_id: order.id,
      product_name: item.product_name.trim(),
      quantity: Number(item.quantity),
      unit: item.unit.trim(),
      preparation: item.preparation?.trim() || null,
      notes: item.notes?.trim() || null,
      unit_price: Number(item.unit_price ?? 0),
      sort_order: index,
    })),
  );

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Could not save order items" }, { status: 500 });
  }

  return NextResponse.json({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
  }, { status: 201 });
}
