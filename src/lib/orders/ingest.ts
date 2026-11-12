import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { syncHighLevelOrderFields, syncWholesalePipeline } from "@/lib/orders/highlevel-pipeline";
import { customerIdentityKey } from "@/lib/orders/wholesale-routes";
import { existingWholesaleCustomerPayload, isExistingWholesaleCustomerOrder } from "@/lib/orders/wholesale-form-customer";

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
  form_data?: { form: string; order_text: string; tax_id?: string; billing?: string; maps_url?: string; receiver_phone?: string; payment_proof?: string; contact_id?: string; location_id?: string; conversation_id?: string; conversation_url?: string; original_payload: Record<string, unknown> };
  items: IngestItem[];
};

export function authorized(request: NextRequest) {
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
    (body.items.length > 0 || (body.source === "form" && typeof body.form_data?.order_text === "string" && Boolean(body.form_data.order_text.trim()))) &&
    body.items.every((item) =>
      Boolean(item?.product_name?.trim()) &&
      Number.isFinite(item?.quantity) &&
      Number(item.quantity) >= 0 &&
      (Number(item.quantity) > 0 || body.customer_type === "wholesale") &&
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

  return ingestOrder(body);
}

export async function ingestOrder(body: IngestBody) {
  const supabase = createAdminClient();
  const identityKey = customerIdentityKey(body.customer_type, {
    businessName: body.customer.business_name,
    name: body.customer.name,
    phone: body.customer.phone,
  });
  if (!identityKey) return NextResponse.json({ error: "Could not identify customer" }, { status: 422 });
  const submittedRouteName = body.route?.trim();
  const routeName = submittedRouteName || "Sin clasificar";
  let { data: route } = await supabase.from("routes").select("id").eq("name", routeName).maybeSingle();
  // Fuentes distintas al formulario todavía pueden proponer una ruta nueva.
  if (!route && submittedRouteName) {
    const { data: createdRoute, error: routeError } = await supabase
      .from("routes")
      .insert({ name: routeName, sort_order: 900 })
      .select("id")
      .maybeSingle();
    if (createdRoute) route = createdRoute;
    else if (routeError?.code === "23505") {
      const concurrentRoute = await supabase.from("routes").select("id").eq("name", routeName).maybeSingle();
      route = concurrentRoute.data;
    }
  }
  const { data: fallbackRoute } = route
    ? { data: null }
    : await supabase.from("routes").select("id").eq("name", "Sin clasificar").single();
  const routeId = route?.id ?? fallbackRoute?.id ?? null;

  const { data: existingCustomer, error: existingCustomerError } = await supabase
    .from("customers")
    .select("id,name,phone,business_name,tax_id,email,address,neighborhood,city,route_id")
    .eq("customer_type", body.customer_type)
    .eq("identity_key", identityKey)
    .maybeSingle();
  if (existingCustomerError) {
    return NextResponse.json({ error: "Could not look up customer" }, { status: 500 });
  }
  const usesExistingWholesaleCustomer = isExistingWholesaleCustomerOrder(body);
  if (usesExistingWholesaleCustomer && !existingCustomer) {
    return NextResponse.json({ error: "Mayorista no registrado; use el formulario Nuevo Mayorista" }, { status: 422 });
  }
  const normalizedBody = usesExistingWholesaleCustomer
    ? { ...body, customer: existingWholesaleCustomerPayload(body.customer, existingCustomer!) }
    : body;
  // Si el cliente ya tiene una ruta asignada desde el directorio, sus pedidos
  // siguientes la heredan. Los clientes nuevos permanecen "Sin clasificar".
  const customerRouteId = submittedRouteName ? routeId : existingCustomer?.route_id ?? routeId;
  const orderRouteId = customerRouteId;

  let customer: { id: number } | null = usesExistingWholesaleCustomer ? { id: existingCustomer!.id } : null;
  let customerError = null;
  if (!usesExistingWholesaleCustomer) {
    const result = await supabase
      .from("customers")
      .upsert({
        customer_type: normalizedBody.customer_type,
        identity_key: identityKey,
        name: normalizedBody.customer.name.trim(),
        phone: normalizedBody.customer.phone.trim(),
        business_name: normalizedBody.customer.business_name?.trim() || existingCustomer?.business_name || null,
        tax_id: normalizedBody.customer.tax_id?.trim() || existingCustomer?.tax_id || null,
        email: normalizedBody.customer.email?.trim() || existingCustomer?.email || null,
        address: normalizedBody.customer.address?.trim() || existingCustomer?.address || null,
        neighborhood: normalizedBody.customer.neighborhood?.trim() || existingCustomer?.neighborhood || null,
        city: normalizedBody.customer.city?.trim() || existingCustomer?.city || "Barranquilla",
        route_id: customerRouteId,
      }, { onConflict: "customer_type,identity_key" })
      .select("id")
      .single();
    customer = result.data;
    customerError = result.error;
  }

  if (customerError || !customer) {
    return NextResponse.json({ error: "Could not save customer" }, { status: 500 });
  }

  const subtotal = normalizedBody.items.reduce(
    (total, item) => total + Number(item.quantity) * Number(item.unit_price ?? 0),
    0,
  );
  const needsReview = normalizedBody.source === "agent" && (normalizedBody.confidence == null || normalizedBody.confidence < 0.9);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_type: normalizedBody.customer_type,
      customer_id: customer.id,
      route_id: orderRouteId,
      source: normalizedBody.source,
      source_reference: normalizedBody.source_reference ?? null,
      source_payload: normalizedBody,
      extraction_confidence: normalizedBody.confidence ?? null,
      status: needsReview ? "needs_review" : "received",
      fulfillment_type: normalizedBody.fulfillment_type ?? "delivery",
      requested_delivery_at: normalizedBody.requested_delivery_at ?? null,
      delivery_address: normalizedBody.delivery_address ?? normalizedBody.customer.address ?? existingCustomer?.address ?? null,
      delivery_notes: normalizedBody.delivery_notes ?? null,
      payment_method: normalizedBody.payment_method ?? null,
      subtotal,
      notes: normalizedBody.notes ?? null,
    })
    .select("id, order_number, status")
    .single();

  if (orderError || !order) {
    const status = orderError?.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "Order already received" : "Could not save order" }, { status });
  }

  const { error: itemsError } = normalizedBody.items.length ? await supabase.from("order_items").insert(
    normalizedBody.items.map((item, index) => ({
      order_id: order.id,
      product_name: item.product_name.trim(),
      quantity: Number(item.quantity),
      unit: item.unit.trim(),
      preparation: item.preparation?.trim() || null,
      notes: item.notes?.trim() || null,
      unit_price: Number(item.unit_price ?? 0),
      sort_order: index,
    })),
  ) : { error: null };

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Could not save order items" }, { status: 500 });
  }

  const highLevelContext = { contactId: normalizedBody.form_data?.contact_id, locationId: normalizedBody.form_data?.location_id, conversationId: normalizedBody.form_data?.conversation_id };
  const [pipeline, orderFields] = normalizedBody.customer_type === "wholesale" && normalizedBody.form_data
    ? await Promise.all([
        syncWholesalePipeline(
          highLevelContext,
          "order_placed",
          `${normalizedBody.customer.name} · ${order.order_number}`,
          subtotal,
        ),
        syncHighLevelOrderFields(highLevelContext, { orderNumber: order.order_number, total: subtotal }),
      ])
    : [{ ok: false as const, skipped: true as const }, { ok: false as const, skipped: true as const }];

  return NextResponse.json({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    pipeline_synced: pipeline.ok,
    order_field_synced: orderFields.ok,
  }, { status: 201 });
}
