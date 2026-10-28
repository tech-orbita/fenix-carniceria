import { requireViewer } from "@/lib/auth/viewer";
import { hasSupabaseEnvironment } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { parseOrderText } from "@/lib/orders/product-parser";

import "../auth.css";
import { OrdersPanel } from "./orders-panel";
import { demoOrders } from "./demo-orders";
import type { Order } from "./types";

export const dynamic = "force-dynamic";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function cleanAddress(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/,\s*$/, "") : undefined;
}

function formAddressDetails(sourcePayload: unknown) {
  const payload = objectValue(sourcePayload);
  const formData = objectValue(payload?.form_data);
  const original = objectValue(formData?.original_payload);
  const customData = objectValue(original?.customData);
  const location = objectValue(original?.location);
  return {
    contact: cleanAddress(customData?.address) ?? cleanAddress(original?.address1) ?? cleanAddress(original?.full_address),
    location: cleanAddress(location?.address) ?? cleanAddress(location?.fullAddress),
  };
}

function sameAddress(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "");
  return normalize(left) === normalize(right) || normalize(right).startsWith(normalize(left));
}

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
      customers (name, business_name, phone, address),
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
        const storedItems = (row.order_items ?? []).map((item) => ({
          id: String(item.id),
          productName: item.product_name,
          quantity: Number(item.quantity),
          unit: item.unit,
          actualQuantity: item.actual_quantity == null ? undefined : Number(item.actual_quantity),
          preparation: item.preparation ?? undefined,
          notes: item.notes ?? undefined,
          unitPrice: Number(item.unit_price),
        }));
        const reparsedItems = row.customer_type === "wholesale" && typeof formData?.order_text === "string"
          ? parseOrderText(formData.order_text)
          : [];
        const items = reparsedItems.length > storedItems.length
          ? reparsedItems.map((item, index) => ({
              id: `parsed-${row.id}-${index}`,
              productName: item.product_name,
              quantity: item.quantity,
              unit: item.unit,
              preparation: item.preparation,
              unitPrice: 0,
            }))
          : storedItems;
        const addresses = formAddressDetails(sourcePayload);
        const storedAddress = [row.delivery_address, customer?.address]
          .map(cleanAddress)
          .find((address) => address && !sameAddress(address, addresses.location));
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
          address: addresses.contact ?? storedAddress ?? "Sin dirección",
          route: route?.name ?? "Sin clasificar",
          source: row.source,
          paymentMethod: row.payment_method ?? undefined,
          paymentStatus: row.payment_status,
          deliveryFee: Number(row.delivery_fee),
          adjustments: Number(row.adjustments),
          total: Number(row.total),
          status: row.status,
          items,
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
