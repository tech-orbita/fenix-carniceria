import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type TestItem = { product_name: string; quantity: number; unit: string; preparation?: string; notes?: string };
const allowedOrigin = "https://fenix-carniceria-git-preview-formulario-mayori-1c1f8f-orbita-ia.vercel.app";
const testAccessHash = "97aea86a0d310793cb652dc0e73533fe7a09a77f4a2b0446b153b937e0a177f0";
const testAccessExpiresAt = Date.parse("2026-11-29T05:00:00Z");

function json(body: Record<string, unknown>, status: number, origin?: string | null) {
  const response = NextResponse.json(body, { status });
  if (origin === allowedOrigin) response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  return response;
}

function authorizedTestAccess(value: unknown) {
  if (typeof value !== "string" || Date.now() > testAccessExpiresAt) return false;
  const supplied = Buffer.from(createHash("sha256").update(value).digest("hex"));
  const expected = Buffer.from(testAccessHash);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function testItems(value: unknown): TestItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new Error("Agrega entre 1 y 50 productos.");
  return value.map((raw, index) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const productName = text(item.product_name ?? item.productName, 160);
    const quantity = Number(item.quantity);
    const unit = text(item.unit, 20) || "cantidad";
    if (!productName) throw new Error(`Falta el producto del renglón ${index + 1}.`);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 10_000) throw new Error(`Cantidad inválida en el renglón ${index + 1}.`);
    return {
      product_name: productName,
      quantity,
      unit,
      preparation: text(item.preparation, 250) || undefined,
      notes: text(item.notes, 500) || undefined,
    };
  });
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== allowedOrigin) return json({ error: "Origen no permitido." }, 403);
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Max-Age", "600");
  return response;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== allowedOrigin) return json({ error: "Origen no permitido." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) return json({ error: "La prueba es demasiado grande." }, 413, origin);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ error: "No pudimos leer la prueba." }, 400, origin); }
  if (!authorizedTestAccess(input.testAccess)) return json({ error: "El acceso de prueba no es válido o venció." }, 403, origin);

  const businessName = text(input.businessName, 160);
  const phone = text(input.phone, 30);
  const customerName = text(input.customerName, 160) || businessName;
  const variant = input.variant === "catalog" ? "catalog" : "free_text";
  const notes = text(input.notes, 2_000);
  const orderText = text(input.orderText, 6_000);
  const proofName = text(input.paymentProofName, 180);
  if (!businessName || !phone) return json({ error: "Escribe establecimiento y teléfono." }, 422, origin);
  let items: TestItem[];
  try { items = testItems(input.items); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Productos inválidos." }, 422, origin); }

  const supabase = createAdminClient();
  const { count: recentTests, error: rateError } = await supabase.from("orders")
    .select("id", { count: "exact", head: true })
    .like("source_reference", "test-form:%")
    .gte("received_at", new Date(Date.now() - 60 * 60_000).toISOString());
  if (rateError) return json({ error: "No pudimos validar el límite de pruebas." }, 500, origin);
  if ((recentTests ?? 0) >= 50) return json({ error: "Se alcanzó el límite temporal de pruebas. Intenta más tarde." }, 429, origin);
  const identityKey = "business:pruebas formulario mayorista";
  const { data: testCustomer, error: customerError } = await supabase.from("customers").upsert({
    customer_type: "wholesale",
    identity_key: identityKey,
    name: "Cliente de prueba",
    business_name: "Pruebas formulario mayorista",
    phone: "+570000000000",
    address: "Registro técnico de pruebas - no despachar",
    route_id: null,
    is_active: false,
  }, { onConflict: "customer_type,identity_key" }).select("id").single();
  if (customerError || !testCustomer) return json({ error: "No pudimos preparar el registro de prueba." }, 500, origin);

  const sourceReference = `test-form:${randomUUID()}`;
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    customer_type: "wholesale",
    customer_id: testCustomer.id,
    route_id: null,
    source: "form",
    source_reference: sourceReference,
    source_payload: {
      test_submission: true,
      test_variant: variant,
      test_customer: { name: customerName, business_name: businessName, phone },
      test_payment_proof_name: proofName || null,
      form_data: { form: variant === "catalog" ? "Prueba formulario por catálogo" : "Prueba formulario libre", order_text: orderText || null },
    },
    status: "received",
    fulfillment_type: "delivery",
    delivery_address: "PRUEBA - NO DESPACHAR",
    payment_status: "pending",
    notes: ["[PRUEBA FORMULARIO]", notes].filter(Boolean).join(" "),
    subtotal: 0,
  }).select("id,order_number").single();
  if (orderError || !order) return json({ error: "No pudimos crear el pedido de prueba." }, 500, origin);

  const { error: itemsError } = await supabase.from("order_items").insert(items.map((item, index) => ({
    order_id: order.id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit: item.unit,
    preparation: item.preparation ?? null,
    notes: item.notes ?? null,
    unit_price: 0,
    sort_order: index,
  })));
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return json({ error: "No pudimos guardar los productos de la prueba." }, 500, origin);
  }

  return json({ ok: true, orderNumber: order.order_number, markedAsTest: true }, 201, origin);
}
