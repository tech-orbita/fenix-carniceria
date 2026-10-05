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
