import { requireViewer } from "@/lib/auth/viewer";
import { hasSupabaseEnvironment } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import "../auth.css";
import { OrdersPanel } from "./orders-panel";
import { demoOrders } from "./demo-orders";
import type { Order } from "./types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!hasSupabaseEnvironment()) {
    return <OrdersPanel initialOrders={demoOrders()} loadError="Modo demostración: configura Supabase para usar pedidos reales." />;
  }

  const viewer = await requireViewer();
  const supabase = await createClient();

  // RLS limita las filas al segmento del usuario; el filtro explícito lo deja claro.
  let query = supabase
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
      total,
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
        notes,
        unit_price
      )
    `)
    .order("received_at", { ascending: false });
  if (viewer.customerType) query = query.eq("customer_type", viewer.customerType);
  const { data: rows, error: ordersError } = await query;

  const orders: Order[] = ordersError
    ? []
    : (rows ?? []).map((row) => {
        const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
        const route = Array.isArray(row.routes) ? row.routes[0] : row.routes;

        const sourcePayload = row.source_payload && typeof row.source_payload === "object" ? row.source_payload : {};
        const formData = sourcePayload.form_data && typeof sourcePayload.form_data === "object" ? sourcePayload.form_data : undefined;
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
          total: Number(row.total),
          status: row.status,
          items: (row.order_items ?? []).map((item) => ({
            id: String(item.id),
            productName: item.product_name,
            quantity: Number(item.quantity),
            unit: item.unit,
            actualQuantity: item.actual_quantity == null ? undefined : Number(item.actual_quantity),
            preparation: item.preparation ?? undefined,
            notes: item.notes ?? undefined,
            unitPrice: Number(item.unit_price),
          })),
          formData,
          highLevel: {
            contactId: formData?.contact_id ?? sourcePayload.contactId,
            locationId: formData?.location_id ?? sourcePayload.locationId,
            conversationId: formData?.conversation_id ?? sourcePayload.conversationId,
            conversationUrl: formData?.conversation_url ?? sourcePayload.conversationUrl,
          },
          notes: row.notes ?? undefined,
        };
      });

  return <OrdersPanel initialOrders={orders} viewer={viewer} loadError={ordersError ? "No se pudieron cargar los pedidos. Intenta nuevamente." : undefined} />;
}
