import { createAdminClient } from "@/lib/supabase/admin";

import { OrdersPanel } from "./orders-panel";
import type { Order } from "./types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return <OrdersPanel initialOrders={[]} loadError="El panel no está conectado a la base de datos." />;
  }

  const { data: rows, error: ordersError } = await admin
    .from("orders")
    .select(`
      id,
      order_number,
      customer_type,
      source,
      source_payload,
      status,
      fulfillment_type,
      requested_delivery_at,
      delivery_address,
      payment_method,
      payment_status,
      delivery_fee,
      adjustments,
      notes,
      received_at,
      customers (name, business_name, phone),
      routes (name),
      order_items (
        id,
        product_name,
        quantity,
        unit,
        actual_quantity,
        preparation,
        unit_price
      )
    `)
    .order("received_at", { ascending: false });

  const orders: Order[] = ordersError
    ? []
    : (rows ?? []).map((row) => {
        const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
        const route = Array.isArray(row.routes) ? row.routes[0] : row.routes;

        return {
          id: String(row.id),
          orderNumber: row.order_number,
          customerType: row.customer_type,
          customer: customer?.name ?? "Cliente sin nombre",
          businessName: customer?.business_name ?? undefined,
          phone: customer?.phone ?? "Sin teléfono",
          receivedAt: row.received_at,
          deliveryDate: row.requested_delivery_at?.slice(0, 10) ?? "Sin fecha",
          fulfillment: row.fulfillment_type,
          address: row.delivery_address ?? "Sin dirección",
          route: route?.name ?? "Sin clasificar",
          source: row.source,
          paymentMethod: row.payment_method ?? undefined,
          paymentStatus: row.payment_status,
          deliveryFee: Number(row.delivery_fee),
          adjustments: Number(row.adjustments),
          status: row.status,
          items: (row.order_items ?? []).map((item) => ({
            id: String(item.id),
            productName: item.product_name,
            quantity: Number(item.quantity),
            unit: item.unit,
            actualQuantity: item.actual_quantity == null ? undefined : Number(item.actual_quantity),
            preparation: item.preparation ?? undefined,
            unitPrice: Number(item.unit_price),
          })),
          formData: row.source_payload?.form_data ?? undefined,
          notes: row.notes ?? undefined,
        };
      });

  const dataVersion = orders
    .map((order) => `${order.id}:${order.status}:${order.paymentStatus}:${order.receivedAt}:${order.notes ?? ""}:${order.items.map((item) => `${item.id}-${item.actualQuantity ?? item.quantity}-${item.unit}`).join(",")}`)
    .join("|");

  return <OrdersPanel initialOrders={orders} key={dataVersion} loadError={ordersError ? "No se pudieron cargar los pedidos. Intenta nuevamente." : undefined} />;
}
