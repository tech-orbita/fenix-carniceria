"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
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

  const supabase = await createClient();
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
