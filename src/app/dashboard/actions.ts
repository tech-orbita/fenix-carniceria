"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { catalogProductFor, normalizeProductName } from "@/lib/orders/product-parser";

import type { OrderStatus } from "./types";

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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", Number(orderId));

  if (error) {
    return { ok: false, message: "No se pudo actualizar el pedido." };
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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("id", Number(orderId))
    .eq("customer_type", "retail");

  if (error) {
    return { ok: false, message: "No se pudo actualizar el estado de pago." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Estado de pago actualizado." };
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

  const supabase = createAdminClient();
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
  return { quantity, unit: match[2]?.trim().toLocaleLowerCase("es") || "lb" };
}

function sameProduct(left: string, right: string) {
  const leftCatalog = catalogProductFor(left)?.name;
  const rightCatalog = catalogProductFor(right)?.name;
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
        !productName.trim() || productName.length > 120 || value.length > 40 || (value.trim() && !parseQuantity(value)),
      )
    ) {
      return { ok: false, message: "Revisa las cantidades. Usa valores como “1 lb” o “2 kg”." };
    }
  }

  const supabase = createAdminClient();

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
      const parsed = entry.value.trim() ? parseQuantity(entry.value) : null;

      if (!entry.value.trim()) {
        if (matching.length) {
          const { error } = await supabase.from("order_items").delete().in("id", matching.map((item) => item.id));
          if (error) return { ok: false, message: "No se pudo quitar una cantidad de la tabla." };
        }
        continue;
      }

      if (!parsed) return { ok: false, message: "Usa cantidades como “1 lb” o “2 kg”." };
      const canonicalName = catalogProductFor(entry.productName)?.name ?? entry.productName.trim();

      if (matching[0]) {
        const { error } = await supabase.from("order_items").update({
          product_name: canonicalName,
          actual_quantity: parsed.quantity,
          unit: parsed.unit,
        }).eq("id", matching[0].id).eq("order_id", orderId);
        if (error) return { ok: false, message: "No se pudo actualizar una cantidad." };
        if (matching.length > 1) await supabase.from("order_items").delete().in("id", matching.slice(1).map((item) => item.id));
      } else {
        const { error } = await supabase.from("order_items").insert({
          order_id: orderId,
          product_name: canonicalName,
          quantity: parsed.quantity,
          actual_quantity: parsed.quantity,
          unit: parsed.unit,
          unit_price: 0,
          sort_order: existingItems?.length ?? 0,
        });
        if (error) return { ok: false, message: "No se pudo agregar una cantidad." };
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  return { ok: true, message: "La tabla y los comentarios fueron actualizados." };
}
