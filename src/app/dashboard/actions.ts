"use server";

import { revalidatePath } from "next/cache";

import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { catalogProductFor, normalizeProductName, toKilograms } from "@/lib/orders/product-parser";
import { sendWholesalePaymentSummary, syncWholesalePipeline } from "@/lib/orders/highlevel-pipeline";
import type { HighLevelContext, WholesalePipelineStage } from "@/lib/orders/highlevel-pipeline";

import type { OrderStatus } from "./types";

// Las acciones usan la sesión del usuario: RLS solo deja tocar pedidos de su segmento.
async function sessionClient() {
  await requireViewer();
  return createClient();
}

function highLevelContext(sourcePayload: unknown): HighLevelContext {
  const payload = sourcePayload && typeof sourcePayload === "object" ? sourcePayload as Record<string, unknown> : {};
  const form = payload.form_data && typeof payload.form_data === "object" ? payload.form_data as Record<string, unknown> : {};
  const value = (key: string) => typeof form[key] === "string" ? form[key] as string : typeof payload[key] === "string" ? payload[key] as string : undefined;
  return { contactId: value("contact_id") ?? value("contactId"), locationId: value("location_id") ?? value("locationId"), conversationId: value("conversation_id") ?? value("conversationId") };
}

function pipelineStageFor(status: OrderStatus): WholesalePipelineStage | undefined {
  if (["received", "quoted", "confirmed"].includes(status)) return "order_placed";
  if (["preparing", "ready"].includes(status)) return "preparing";
  if (["dispatched", "delivered"].includes(status)) return "dispatched";
  if (["needs_review", "incident"].includes(status)) return "help";
  return undefined;
}

const allowedStatuses: OrderStatus[] = [
  "needs_review",
  "received",
  "quoted",
  "confirmed",
  "preparing",
  "ready",
  "dispatched",
  "delivered",
  "cancelled",
  "incident",
];

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  if (!/^\d+$/.test(orderId) || !allowedStatuses.includes(status)) {
    return { ok: false, message: "Pedido o estado inválido." };
  }

  const supabase = await sessionClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", Number(orderId))
    .select("id,order_number,customer_type,source_payload,total,customers(name,business_name)")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "No se pudo actualizar el pedido." };
  }

  const pipelineStage = data.customer_type === "wholesale" ? pipelineStageFor(status) : undefined;
  if (pipelineStage) {
    const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    await syncWholesalePipeline(
      highLevelContext(data.source_payload),
      pipelineStage,
      `${customer?.business_name || customer?.name || "Cliente"} · ${data.order_number}`,
      Number(data.total),
    );
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Estado actualizado." };
}

export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: "paid" | "pending",
) {
  if (!/^\d+$/.test(orderId) || !["paid", "pending"].includes(paymentStatus)) {
    return { ok: false, message: "Pedido o estado de pago inválido." };
  }

  const supabase = await sessionClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("id", Number(orderId))
    .eq("customer_type", "retail")
    .select("id");

  if (error || !data?.length) {
    return { ok: false, message: "No se pudo actualizar el estado de pago." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Estado de pago actualizado." };
}

export async function scheduleWholesaleOrder(orderId: string, deliveryDay: string) {
  if (!/^\d+$/.test(orderId) || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDay)) {
    return { ok: false, message: "Pedido o fecha inválida." };
  }
  const parsed = new Date(`${deliveryDay}T12:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) return { ok: false, message: "Fecha inválida." };
  const supabase = await sessionClient();
  const { data, error } = await supabase.from("orders")
    .update({ requested_delivery_at: parsed.toISOString() })
    .eq("id", Number(orderId))
    .eq("customer_type", "wholesale")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No se pudo adelantar el pedido." };
  revalidatePath("/dashboard");
  return { ok: true, message: "Pedido autorizado para despacho hoy." };
}

export async function updateWholesalePayment(
  orderId: string,
  total: number,
  paymentStatus: "pending" | "paid",
  sendSummary = false,
) {
  if (!/^\d+$/.test(orderId) || !Number.isFinite(total) || total < 0 || total > 999_999_999 || !["pending", "paid"].includes(paymentStatus)) {
    return { ok: false, message: "Revisa el valor y el estado de pago." };
  }
  const supabase = await sessionClient();
  const { data, error } = await supabase.from("orders")
    .update({ subtotal: total, delivery_fee: 0, adjustments: 0, payment_status: paymentStatus })
    .eq("id", Number(orderId))
    .eq("customer_type", "wholesale")
    .select("id,order_number,source_payload,customers(name,business_name)")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No se pudo actualizar la cartera del pedido." };
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const context = highLevelContext(data.source_payload);
  await syncWholesalePipeline(
    context,
    paymentStatus === "paid" ? "paid" : "payment_pending",
    `${customer?.business_name || customer?.name || "Cliente"} · ${data.order_number}`,
    total,
  );
  if (sendSummary) {
    const sent = await sendWholesalePaymentSummary(context, customer?.business_name || customer?.name || "cliente", data.order_number, total);
    if (!sent.ok) return { ok: false, message: `Se guardó la cartera, pero ${sent.message}` };
  }
  revalidatePath("/dashboard");
  return { ok: true, message: sendSummary ? "Cartera actualizada y resumen enviado." : "Cartera actualizada." };
}

type OrderDetailsInput = {
  customer: string;
  phone: string;
  address: string;
  notes: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unit: string;
    preparation: string;
  }>;
};

export async function updateOrderDetails(
  orderId: string,
  details: OrderDetailsInput,
) {
  if (!/^\d+$/.test(orderId)) {
    return { ok: false, message: "Pedido o cliente inválido." };
  }

  const customer = details.customer.trim();
  const phone = details.phone.trim();
  const address = details.address.trim();
  const notes = details.notes.trim();

  if (
    !customer ||
    !phone ||
    !address ||
    !details.items.length ||
    details.items.some((item) =>
      !/^\d+$/.test(item.id) ||
      !item.productName.trim() ||
      !item.unit.trim() ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0,
    )
  ) {
    return { ok: false, message: "Revisa los datos del cliente y las cantidades del pedido." };
  }

  const supabase = await sessionClient();
  const { data: order, error: lookupError } = await supabase
    .from("orders")
    .select("customer_id")
    .eq("id", Number(orderId))
    .single();

  if (lookupError || !order) {
    return { ok: false, message: "No se encontró el pedido para editar." };
  }

  const [customerResult, orderResult, ...itemResults] = await Promise.all([
    supabase
      .from("customers")
      .update({ name: customer, phone, address })
      .eq("id", Number(order.customer_id)),
    supabase
      .from("orders")
      .update({ delivery_address: address, notes: notes || null })
      .eq("id", Number(orderId)),
    ...details.items.map((item) =>
      supabase
        .from("order_items")
        .update({
          product_name: item.productName.trim(),
          actual_quantity: item.quantity,
          unit: item.unit.trim(),
          preparation: item.preparation.trim() || null,
        })
        .eq("id", Number(item.id))
        .eq("order_id", Number(orderId)),
    ),
  ]);

  if (customerResult.error || orderResult.error || itemResults.some((result) => result.error)) {
    return { ok: false, message: "No se pudieron guardar todos los cambios." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Pedido actualizado." };
}

type WholesaleTableRowInput = {
  orderId: string;
  notes: string;
  quantities: Array<{ productName: string; value: string }>;
};

function parseQuantity(value: string) {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*([\p{L}]+)?$/u);
  if (!match) return null;
  const quantity = Number(match[1].replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  // La tabla trabaja en kilos: un número solo es kg y las libras se guardan convertidas (1 lb = 0,5 kg).
  return toKilograms(quantity, match[2] ?? "kg");
}

function parseWholesaleCell(productName: string, value: string) {
  const normalizedProduct = normalizeProductName(productName);
  if (normalizedProduct === "comodin") {
    const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return null;
    const parsed = parts.map((part) => {
      const match = part.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilo|kilos|lb|lbs|libra|libras)?\s+(.+)$/i);
      if (!match) return null;
      const quantity = Number(match[1].replace(",", "."));
      const preparation = match[3].trim();
      if (!Number.isFinite(quantity) || quantity <= 0 || !preparation) return null;
      return { ...toKilograms(quantity, match[2] ?? "kg"), preparation: preparation.slice(0, 250) };
    });
    return parsed.every(Boolean) ? parsed as Array<{ quantity: number; unit: string; preparation: string }> : null;
  }
  if (normalizedProduct !== "blanda") {
    const parsed = parseQuantity(value);
    return parsed ? [{ ...parsed, preparation: null as string | null }] : null;
  }
  const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const parsed = parts.map((part) => {
    const match = part.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilo|kilos|lb|lbs|libra|libras)?\s*([CLTB])?$/i);
    if (!match) return null;
    const quantity = Number(match[1].replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    return { ...toKilograms(quantity, match[2] ?? "kg"), preparation: match[3]?.toUpperCase() ?? null };
  });
  return parsed.every(Boolean) ? parsed as Array<{ quantity: number; unit: string; preparation: string | null }> : null;
}

function sameProduct(left: string, right: string) {
  const leftCatalog = catalogProductFor(left)?.name;
  const rightCatalog = catalogProductFor(right)?.name;
  if (normalizeProductName(rightCatalog ?? right) === "comodin") {
    return !leftCatalog || normalizeProductName(leftCatalog) === "comodin";
  }
  return normalizeProductName(leftCatalog ?? left) === normalizeProductName(rightCatalog ?? right);
}

export async function updateWholesaleTable(rows: WholesaleTableRowInput[]) {
  if (!Array.isArray(rows) || rows.length > 200) {
    return { ok: false, message: "La edición de la tabla no es válida." };
  }

  for (const row of rows) {
    if (
      !/^\d+$/.test(row.orderId) ||
      typeof row.notes !== "string" ||
      row.notes.length > 2_000 ||
      !Array.isArray(row.quantities) ||
      row.quantities.length > 100 ||
      row.quantities.some(({ productName, value }) =>
        !productName.trim() || productName.length > 120 || value.length > 80 || (value.trim() && !parseWholesaleCell(productName, value)),
      )
    ) {
      return { ok: false, message: "Revisa las cantidades. Usa valores en kg como “1,5” o “2 kg”." };
    }
  }

  const supabase = await sessionClient();

  for (const row of rows) {
    const orderId = Number(row.orderId);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .eq("customer_type", "wholesale")
      .maybeSingle();

    if (orderError || !order) return { ok: false, message: "No se encontró un pedido mayorista para editar." };

    const { data: existingItems, error: lookupError } = await supabase
      .from("order_items")
      .select("id,product_name,unit")
      .eq("order_id", orderId);

    if (lookupError) return { ok: false, message: "No se pudo consultar el pedido para editarlo." };

    const { error: noteError } = await supabase
      .from("orders")
      .update({ notes: row.notes.trim() || null })
      .eq("id", orderId);

    if (noteError) return { ok: false, message: "No se pudo guardar el comentario." };

    for (const entry of row.quantities) {
      const matching = (existingItems ?? []).filter((item) => sameProduct(item.product_name, entry.productName));
      const parsedValues = entry.value.trim() ? parseWholesaleCell(entry.productName, entry.value) : null;

      if (!entry.value.trim()) {
        if (matching.length) {
          const { error } = await supabase.from("order_items").delete().in("id", matching.map((item) => item.id));
          if (error) return { ok: false, message: "No se pudo quitar una cantidad de la tabla." };
        }
        continue;
      }

      if (!parsedValues) return { ok: false, message: "Usa cantidades como “1,5”, para Blanda “5 C / 2 L” y para Comodín “2 kg producto”." };
      const canonicalName = catalogProductFor(entry.productName)?.name ?? entry.productName.trim();

      if (matching.length) {
        const { error } = await supabase.from("order_items").delete().in("id", matching.map((item) => item.id));
        if (error) return { ok: false, message: "No se pudo actualizar una cantidad." };
      }
      const { error } = await supabase.from("order_items").insert(parsedValues.map((parsed, index) => ({
          order_id: orderId,
          product_name: canonicalName,
          quantity: parsed.quantity,
          actual_quantity: parsed.quantity,
          unit: parsed.unit,
          preparation: parsed.preparation,
          unit_price: 0,
          sort_order: (existingItems?.length ?? 0) + index,
        })));
      if (error) return { ok: false, message: "No se pudo agregar una cantidad." };
    }
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  return { ok: true, message: "La tabla y los comentarios fueron actualizados." };
}
