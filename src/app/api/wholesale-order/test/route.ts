import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { sameOrigin } from "@/lib/orders/wholesale-portal-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type TestItem = { product_name: string; quantity: number; unit: string; preparation?: string; notes?: string };

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

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Ruta disponible únicamente en el entorno de prueba." }, { status: 404 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) return NextResponse.json({ error: "La prueba es demasiado grande." }, { status: 413 });

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "No pudimos leer la prueba." }, { status: 400 }); }

  const businessName = text(input.businessName, 160);
  const phone = text(input.phone, 30);
  const customerName = text(input.customerName, 160) || businessName;
  const variant = input.variant === "catalog" ? "catalog" : "free_text";
  const notes = text(input.notes, 2_000);
  const orderText = text(input.orderText, 6_000);
  const proofName = text(input.paymentProofName, 180);
  if (!businessName || !phone) return NextResponse.json({ error: "Escribe establecimiento y teléfono." }, { status: 422 });
  let items: TestItem[];
  try { items = testItems(input.items); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Productos inválidos." }, { status: 422 }); }

  const supabase = createAdminClient();
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
  if (customerError || !testCustomer) return NextResponse.json({ error: "No pudimos preparar el registro de prueba." }, { status: 500 });

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
  if (orderError || !order) return NextResponse.json({ error: "No pudimos crear el pedido de prueba." }, { status: 500 });

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
    return NextResponse.json({ error: "No pudimos guardar los productos de la prueba." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orderNumber: order.order_number, markedAsTest: true }, { status: 201 });
}
