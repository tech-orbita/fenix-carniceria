import { requireViewer } from "@/lib/auth/viewer";
import { hasSupabaseEnvironment } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { normalizeProductName, parseOrderText } from "@/lib/orders/product-parser";
import { loadRetailCatalog } from "@/lib/orders/retail-agent";
import { retailCatalogPrice } from "@/lib/orders/retail-normalization";

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

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  if (process.env.NODE_ENV !== "production" && demo === "contacto") {
    return <OrdersPanel initialOrders={demoOrders()} loadError="Vista previa local: empresa y persona de contacto separadas." />;
  }

  if (!hasSupabaseEnvironment()) {
    return <OrdersPanel initialOrders={demoOrders()} loadError="Modo demostración: configura Supabase para usar pedidos reales." />;
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const canSeeWholesaleWallet = viewer.role === "admin";

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
  const [{ data: rows, error: ordersError }, retailCatalog] = await Promise.all([query, loadRetailCatalog()]);

  const orders: Order[] = ordersError
    ? []
    : (rows ?? []).map((row) => {
        const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
        const route = Array.isArray(row.routes) ? row.routes[0] : row.routes;

        const sourcePayload = row.source_payload && typeof row.source_payload === "object" ? row.source_payload : {};
        const formData = sourcePayload.form_data && typeof sourcePayload.form_data === "object" ? sourcePayload.form_data : undefined;
        const submittedCustomer = objectValue(sourcePayload.customer);
        const submittedName = typeof submittedCustomer?.name === "string" && submittedCustomer.name.trim() ? submittedCustomer.name.trim() : undefined;
        const submittedBusiness = typeof submittedCustomer?.business_name === "string" && submittedCustomer.business_name.trim() ? submittedCustomer.business_name.trim() : undefined;
        const submittedPhone = typeof submittedCustomer?.phone === "string" && submittedCustomer.phone.trim() ? submittedCustomer.phone.trim() : undefined;
        const submittedAddress = cleanAddress(submittedCustomer?.address);
        const storedItems = (row.order_items ?? []).map((item) => {
          const storedPrice = Number(item.unit_price);
          const catalogPrice = row.customer_type === "retail"
            ? retailCatalogPrice(item.product_name, item.unit, retailCatalog)
            : undefined;
          return {
            id: String(item.id),
            productName: catalogPrice?.product.name ?? item.product_name,
            quantity: Number(item.quantity),
            unit: catalogPrice?.unit ?? item.unit,
            actualQuantity: item.actual_quantity == null ? undefined : Number(item.actual_quantity),
            preparation: item.preparation ?? undefined,
            notes: item.notes ?? undefined,
            // El precio guardado conserva la cotización del pedido; el catálogo
            // vigente completa únicamente líneas que llegaron sin precio.
            unitPrice: storedPrice > 0 ? storedPrice : catalogPrice?.amount ?? 0,
          };
        });
        const reparsedItems = row.customer_type === "wholesale" && typeof formData?.order_text === "string"
          ? parseOrderText(formData.order_text)
          : [];
        const reparsedMatchesStored = reparsedItems.length === storedItems.length && reparsedItems.every((item, index) => (
          normalizeProductName(item.product_name) === normalizeProductName(storedItems[index]?.productName ?? "")
          && (item.preparation ?? "") === (storedItems[index]?.preparation ?? "")
        ));
        const canUseReparsedItems = reparsedItems.length > 0 && storedItems.every((item) => item.actualQuantity == null);
        const items = canUseReparsedItems
          ? reparsedItems.map((item, index) => ({
              id: `parsed-${row.id}-${index}`,
              productName: item.product_name,
              quantity: item.quantity,
              unit: item.unit,
              displayUnit: item.unit,
              preparation: item.preparation,
              notes: item.notes,
              unitPrice: 0,
            }))
          : reparsedMatchesStored
            ? storedItems.map((item, index) => ({ ...item, displayUnit: reparsedItems[index].unit }))
            : storedItems;
        const addresses = formAddressDetails(sourcePayload);
        const storedAddress = [row.delivery_address, customer?.address]
          .map(cleanAddress)
          .find((address) => address && !sameAddress(address, addresses.location));
        const canSeeOrderPayments = row.customer_type === "retail" || canSeeWholesaleWallet;
        const safeFormData = formData ? {
          form: String(formData.form ?? ""),
          order_text: String(formData.order_text ?? ""),
          tax_id: typeof formData.tax_id === "string" ? formData.tax_id : undefined,
          billing: typeof formData.billing === "string" ? formData.billing : undefined,
          maps_url: typeof formData.maps_url === "string" ? formData.maps_url : undefined,
          receiver_phone: typeof formData.receiver_phone === "string" ? formData.receiver_phone : undefined,
          payment_proof: canSeeOrderPayments && typeof formData.payment_proof === "string" ? formData.payment_proof : undefined,
          contact_id: typeof formData.contact_id === "string" ? formData.contact_id : undefined,
          location_id: typeof formData.location_id === "string" ? formData.location_id : undefined,
          conversation_id: typeof formData.conversation_id === "string" ? formData.conversation_id : undefined,
          conversation_url: typeof formData.conversation_url === "string" ? formData.conversation_url : undefined,
        } : undefined;
        return {
          id: String(row.id),
          orderNumber: row.order_number,
          customerType: row.customer_type,
          customer: submittedName ?? customer?.name ?? "Cliente sin nombre",
          businessName: submittedBusiness ?? customer?.business_name ?? undefined,
          phone: submittedPhone ?? customer?.phone ?? "Sin teléfono",
          receivedAt: row.received_at,
          deliveryDate: row.requested_delivery_at?.slice(0, 10) ?? "Sin fecha",
          fulfillment: row.fulfillment_type,
          address: submittedAddress ?? addresses.contact ?? storedAddress ?? "Sin dirección",
          route: route?.name ?? "Sin clasificar",
          source: row.source,
          paymentMethod: canSeeOrderPayments ? row.payment_method ?? undefined : undefined,
          paymentStatus: canSeeOrderPayments ? row.payment_status : "restricted",
          deliveryFee: canSeeOrderPayments ? Number(row.delivery_fee) : 0,
          adjustments: canSeeOrderPayments ? Number(row.adjustments) : 0,
          total: canSeeOrderPayments ? Number(row.total) : 0,
          status: row.status,
          items,
          formData: safeFormData,
          highLevel: {
            contactId: formData?.contact_id ?? sourcePayload.contactId,
            locationId: formData?.location_id ?? sourcePayload.locationId,
            conversationId: formData?.conversation_id ?? sourcePayload.conversationId,
            conversationUrl: formData?.conversation_url ?? sourcePayload.conversationUrl,
          },
          notes: row.notes ?? undefined,
        };
      });

  return <OrdersPanel initialOrders={orders} retailCatalog={retailCatalog} viewer={viewer} loadError={ordersError ? "No se pudieron cargar los pedidos. Intenta nuevamente." : undefined} />;
}
