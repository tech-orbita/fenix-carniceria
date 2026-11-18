import { requireViewer } from "@/lib/auth/viewer";
import { hasSupabaseEnvironment } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { loadRetailCatalog } from "@/lib/orders/retail-agent";
import { retailCatalogPrice } from "@/lib/orders/retail-normalization";
import { unassignedWholesaleRoute, wholesaleRoutes } from "@/lib/orders/wholesale-routes";

import "../auth.css";
import { OrdersPanel } from "./orders-panel";
import { demoOrders } from "./demo-orders";
import type { Order } from "./types";

export const dynamic = "force-dynamic";

function cleanAddress(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/,\s*$/, "") : undefined;
}

const dashboardPageSize = 100;
const allowedRouteFilters = new Set<string>([...wholesaleRoutes, unassignedWholesaleRoute]);

function routeFilters(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return [...new Set(raw.split(",").map((route) => route.trim()).filter((route) => allowedRouteFilters.has(route)))];
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ demo?: string; page?: string; routes?: string | string[] }> }) {
  const { demo, page: rawPage, routes: rawRoutes } = await searchParams;
  const requestedRoutes = routeFilters(rawRoutes);
  const page = Math.min(10, Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1));
  const requestedRows = page * dashboardPageSize;
  if (process.env.NODE_ENV !== "production" && demo === "contacto") {
    const demoRows = demoOrders().filter((order) => !requestedRoutes.length || requestedRoutes.includes(order.route));
    return <OrdersPanel initialOrders={demoRows} loadError="Vista previa local: empresa y persona de contacto separadas." serverRouteFilter={requestedRoutes} />;
  }

  if (!hasSupabaseEnvironment()) {
    return <OrdersPanel initialOrders={demoOrders()} loadError="Modo demostración: configura Supabase para usar pedidos reales." />;
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const canSeeWholesaleWallet = viewer.role === "admin";
  const orderRouteSelection = requestedRoutes.length ? "order_route:routes!inner(name)" : "order_route:routes(name)";

  // RLS limita las filas al segmento del usuario; el filtro explícito lo deja claro.
  let query = supabase
    .from("orders")
    .select(`
      id,
      order_number,
      customer_type,
      source,
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
      form_name:source_payload->form_data->>form,
      form_tax_id:source_payload->form_data->>tax_id,
      form_billing:source_payload->form_data->>billing,
      form_maps_url:source_payload->form_data->>maps_url,
      form_receiver_phone:source_payload->form_data->>receiver_phone,
      form_payment_proof:source_payload->form_data->>payment_proof,
      form_contact_id:source_payload->form_data->>contact_id,
      form_location_id:source_payload->form_data->>location_id,
      form_conversation_id:source_payload->form_data->>conversation_id,
      form_conversation_url:source_payload->form_data->>conversation_url,
      payload_contact_id:source_payload->>contactId,
      payload_location_id:source_payload->>locationId,
      payload_conversation_id:source_payload->>conversationId,
      payload_conversation_url:source_payload->>conversationUrl,
      help_without_order:source_payload->>helpWithoutOrder,
      customers (name, business_name, phone, address, routes (name)),
      ${orderRouteSelection},
      order_items (
        id,
        product_name,
        quantity,
        unit,
        actual_quantity,
        preparation,
        notes,
        unit_price,
        is_prepared
      )
    `)
    .order("received_at", { ascending: false })
    // Pide una fila extra para saber si existe otro lote sin ejecutar COUNT(*).
    .range(0, requestedRows);
  if (viewer.customerType) query = query.eq("customer_type", viewer.customerType);
  // La relación está expuesta con el alias `order_route`; usar el nombre
  // original (`routes.name`) dejaba el filtro sin apuntar al join seleccionado.
  if (requestedRoutes.length) query = query.in("order_route.name", requestedRoutes);
  // Los operadores mayoristas no necesitan descargar ni procesar el catálogo
  // minorista antes de poder abrir su planilla.
  const retailCatalogPromise = viewer.customerType === "wholesale" ? Promise.resolve([]) : loadRetailCatalog();
  const [{ data: queriedRows, error: ordersError }, retailCatalog] = await Promise.all([query, retailCatalogPromise]);
  const hasMoreOrders = (queriedRows?.length ?? 0) > requestedRows;
  const rows = queriedRows?.slice(0, requestedRows);

  const orders: Order[] = ordersError
    ? []
    : (rows ?? []).map((row) => {
        const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
        const route = Array.isArray(row.order_route) ? row.order_route[0] : row.order_route;
        const customerRouteRelation = customer?.routes;
        const customerRoute = Array.isArray(customerRouteRelation) ? customerRouteRelation[0] : customerRouteRelation;

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
            prepared: item.is_prepared === true,
          };
        });
        const items = storedItems;
        const storedAddress = cleanAddress(row.delivery_address) ?? cleanAddress(customer?.address);
        const canSeeOrderPayments = row.customer_type === "retail" || canSeeWholesaleWallet;
        const safeFormData = row.source === "form" ? {
          form: row.form_name ?? "Pedido mayorista",
          tax_id: row.form_tax_id ?? undefined,
          billing: row.form_billing ?? undefined,
          maps_url: row.form_maps_url ?? undefined,
          receiver_phone: row.form_receiver_phone ?? undefined,
          payment_proof: canSeeOrderPayments ? row.form_payment_proof ?? undefined : undefined,
          contact_id: row.form_contact_id ?? undefined,
          location_id: row.form_location_id ?? undefined,
          conversation_id: row.form_conversation_id ?? undefined,
          conversation_url: row.form_conversation_url ?? undefined,
        } : undefined;
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
          address: storedAddress ?? "Sin dirección",
          // La clasificación pertenece al cliente. Usarla como fuente principal
          // evita que un pedido antiguo o sin ruta desaparezca del filtro recién asignado.
          route: customerRoute?.name ?? route?.name ?? "Sin clasificar",
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
            contactId: row.form_contact_id ?? row.payload_contact_id ?? undefined,
            locationId: row.form_location_id ?? row.payload_location_id ?? undefined,
            conversationId: row.form_conversation_id ?? row.payload_conversation_id ?? undefined,
            conversationUrl: row.form_conversation_url ?? row.payload_conversation_url ?? undefined,
          },
          helpRequest: row.help_without_order === "true",
          notes: row.notes ?? undefined,
        };
      });

  return <OrdersPanel hasMoreOrders={hasMoreOrders} initialOrders={orders} loadedOrderPages={page} retailCatalog={retailCatalog} serverRouteFilter={requestedRoutes} viewer={viewer} loadError={ordersError ? "No se pudieron cargar los pedidos. Intenta nuevamente." : undefined} />;
}
