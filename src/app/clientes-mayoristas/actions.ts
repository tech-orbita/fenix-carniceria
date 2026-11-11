"use server";

import { revalidatePath } from "next/cache";

import { canAccess, requireViewer } from "@/lib/auth/viewer";
import { unassignedWholesaleRoute, wholesaleRoutes } from "@/lib/orders/wholesale-routes";
import { createClient } from "@/lib/supabase/server";

const allowedRoutes = new Set<string>([unassignedWholesaleRoute, ...wholesaleRoutes]);
const openOrderStatuses = ["needs_review", "received", "quoted", "confirmed", "preparing", "ready", "incident"];

export async function assignWholesaleCustomerRoutes(customerIds: string[], routeName: string) {
  const viewer = await requireViewer();
  if (!canAccess(viewer, "wholesale")) {
    return { ok: false as const, message: "No tienes permiso para asignar rutas mayoristas." };
  }

  const uniqueIds = [...new Set(customerIds)];
  if (
    uniqueIds.length === 0 ||
    uniqueIds.length > 200 ||
    uniqueIds.some((id) => !/^\d+$/.test(id)) ||
    !allowedRoutes.has(routeName)
  ) {
    return { ok: false as const, message: "Selecciona clientes y una ruta válida." };
  }

  const supabase = await createClient();
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("id")
    .eq("name", routeName)
    .eq("is_active", true)
    .maybeSingle();

  if (routeError || !route) {
    return { ok: false as const, message: "La ruta seleccionada no está disponible." };
  }

  const numericIds = uniqueIds.map(Number);
  const { data: updatedCustomers, error: customerError } = await supabase
    .from("customers")
    .update({ route_id: route.id })
    .eq("customer_type", "wholesale")
    .in("id", numericIds)
    .select("id");

  if (customerError || !updatedCustomers?.length) {
    return { ok: false as const, message: "No se pudo asignar la ruta a los clientes." };
  }

  const updatedIds = updatedCustomers.map((customer) => customer.id);
  const { error: orderError } = await supabase
    .from("orders")
    .update({ route_id: route.id })
    .eq("customer_type", "wholesale")
    .in("customer_id", updatedIds)
    .in("status", openOrderStatuses);

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/clientes-mayoristas");
  const label = routeName === unassignedWholesaleRoute ? routeName : `Ruta ${routeName}`;
  if (orderError) {
    return { ok: true as const, message: `${label} quedó guardada en los clientes, pero sus pedidos pendientes deben revisarse en la planilla.` };
  }
  return {
    ok: true as const,
    message: `${label} asignada a ${updatedCustomers.length} ${updatedCustomers.length === 1 ? "cliente" : "clientes"}.`,
  };
}
