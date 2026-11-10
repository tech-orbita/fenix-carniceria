"use server";

import { revalidatePath } from "next/cache";

import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { catalogProductFor, normalizeProductName, normalizeWholesaleUnit, parseOrderText, toKilograms, UNSPECIFIED_WHOLESALE_UNIT } from "@/lib/orders/product-parser";
import { retailBillMessage, retailDispatchMessage } from "@/lib/orders/retail-bill";
import { sendHighLevelMessage, sendWholesalePaymentSummary, syncHighLevelOrderFields, syncOrderPipeline, syncWholesalePipeline } from "@/lib/orders/highlevel-pipeline";
import { customerIdentityKey, wholesaleRoutes } from "@/lib/orders/wholesale-routes";
import type { HighLevelContext, OrderPipelineStage } from "@/lib/orders/highlevel-pipeline";

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

function pipelineStageFor(status: OrderStatus): OrderPipelineStage | undefined {
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
    .select("id,order_number,customer_type,fulfillment_type,source_payload,total,customers(name,business_name)")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "No se pudo actualizar el pedido." };
  }

  const pipelineStage = pipelineStageFor(status);
  let message = "Estado actualizado.";
  if (pipelineStage) {
    const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    const synced = await syncOrderPipeline(
      highLevelContext(data.source_payload),
      data.customer_type,
      pipelineStage,
      `${customer?.name || "Cliente"} · ${data.order_number}`,
      Number(data.total),
    );
    if (!synced.ok) message = `Estado actualizado, pero no se pudo mover el pipeline: ${synced.message}`;
  }

  if (data.customer_type === "retail" && status === "dispatched") {
    const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    const sent = await sendHighLevelMessage(
      highLevelContext(data.source_payload),
      retailDispatchMessage({
        orderNumber: data.order_number,
        customer: customer?.name || "cliente",
        fulfillment: data.fulfillment_type === "pickup" ? "pickup" : "delivery",
      }),
    );
    if (!sent.ok) {
      message = message === "Estado actualizado."
        ? `Estado actualizado, pero no se pudo avisar al cliente: ${sent.message}`
        : `${message} Tampoco se pudo avisar al cliente: ${sent.message}`;
    } else if (message === "Estado actualizado.") {
      message = "Estado actualizado y cliente notificado por WhatsApp.";
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, message };
}

export async function resolveOrderHelp(orderId: string) {
  if (!/^\d+$/.test(orderId)) return { ok: false as const, message: "Pedido inválido." };

  const supabase = await sessionClient();
  const { data: current, error: currentError } = await supabase
    .from("orders")
    .select("id,status,order_number,customer_type,source_payload,total,customers(name,business_name)")
    .eq("id", Number(orderId))
    .maybeSingle();
  if (currentError || !current || !["incident", "needs_review"].includes(current.status)) {
    return { ok: false as const, message: "El pedido ya no está en Requiere ayuda." };
  }

  const { data: history } = await supabase
    .from("order_status_history")
    .select("previous_status")
    .eq("order_id", Number(orderId))
    .in("new_status", ["incident", "needs_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const candidate = history?.previous_status as OrderStatus | null | undefined;
  const status: OrderStatus = candidate && allowedStatuses.includes(candidate) && !["incident", "needs_review", "cancelled"].includes(candidate)
    ? candidate
    : "received";

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", Number(orderId))
    .eq("status", current.status)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) return { ok: false as const, message: "No se pudo marcar el caso como solucionado." };

  const customer = Array.isArray(current.customers) ? current.customers[0] : current.customers;
  const synced = await syncOrderPipeline(
    highLevelContext(current.source_payload),
    current.customer_type,
    pipelineStageFor(status)!,
    `${customer?.name || "Cliente"} · ${current.order_number}`,
    Number(current.total),
  );
  revalidatePath("/dashboard");
  return {
    ok: true as const,
    status,
    message: synced.ok ? "Caso solucionado y devuelto a su estado anterior." : `Caso solucionado, pero no se pudo mover el pipeline: ${synced.message}`,
  };
}

export async function sendRetailPaymentSummary(orderId: string) {
  if (!/^\d+$/.test(orderId)) return { ok: false as const, message: "Pedido inválido." };

  const supabase = await sessionClient();
  const { data, error } = await supabase
    .from("orders")
    .select("order_number,received_at,payment_status,delivery_fee,adjustments,source_payload,customers(name),order_items(product_name,quantity,actual_quantity,unit,unit_price)")
    .eq("id", Number(orderId))
    .eq("customer_type", "retail")
    .maybeSingle();
  if (error || !data || !data.order_items?.length) return { ok: false as const, message: "No se encontró una cuenta de cobro para enviar." };

  const billItems = data.order_items.map((item) => ({
    productName: item.product_name,
    quantity: Number(item.quantity),
    actualQuantity: item.actual_quantity == null ? undefined : Number(item.actual_quantity),
    unit: item.unit,
    unitPrice: Number(item.unit_price),
  }));
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const sent = await sendHighLevelMessage(highLevelContext(data.source_payload), retailBillMessage({
    orderNumber: data.order_number,
    customer: customer?.name || "cliente",
    receivedAt: data.received_at,
    paymentStatus: data.payment_status,
    deliveryFee: Number(data.delivery_fee),
    adjustments: Number(data.adjustments),
    items: billItems,
  }));
  return sent.ok ? { ok: true as const, message: "Cuenta de cobro enviada por la conversación de Orbita." } : sent;
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
    .select("id,order_number,source_payload,total,customers(name,business_name)")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "No se pudo actualizar el estado de pago." };
  }

  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const synced = await syncOrderPipeline(
    highLevelContext(data.source_payload),
    "retail",
    paymentStatus === "paid" ? "paid" : "payment_pending",
    `${customer?.name || "Cliente"} · ${data.order_number}`,
    Number(data.total),
  );

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: synced.ok
      ? `Estado de pago actualizado y pipeline movido a ${paymentStatus === "paid" ? "Pago" : "Pendiente por Pago"}.`
      : `Estado de pago actualizado, pero no se pudo mover el pipeline: ${synced.message}`,
  };
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

export async function scheduleRetailOrder(orderId: string, deliveryDay: string) {
  if (!/^\d+$/.test(orderId) || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDay)) {
    return { ok: false, message: "Pedido o fecha inválida." };
  }
  const parsed = new Date(`${deliveryDay}T12:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) return { ok: false, message: "Fecha inválida." };
  const supabase = await sessionClient();
  const { data, error } = await supabase.from("orders")
    .update({ requested_delivery_at: parsed.toISOString() })
    .eq("id", Number(orderId))
    .eq("customer_type", "retail")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No se pudo cambiar la fecha de entrega." };
  revalidatePath("/dashboard");
  return { ok: true, message: "Pedido minorista adelantado para entrega hoy." };
}

type ManualWholesaleOrderInput = {
  businessName: string;
  customerName: string;
  phone: string;
  address: string;
  routeName: string;
  orderText: string;
  notes: string;
};

export async function findWholesaleCustomer(businessNameInput: string) {
  const businessName = businessNameInput?.trim();
  if (!businessName || businessName.length > 160) {
    return { ok: false as const, found: false as const, message: "Escribe un establecimiento válido." };
  }

  const supabase = await sessionClient();
  const identityKey = customerIdentityKey("wholesale", { businessName, name: businessName });
  const { data, error } = await supabase
    .from("customers")
    .select("name,business_name,phone,address,routes(name)")
    .eq("customer_type", "wholesale")
    .eq("identity_key", identityKey)
    .maybeSingle();

  if (error) return { ok: false as const, found: false as const, message: "No se pudo consultar el establecimiento." };
  if (!data) return { ok: true as const, found: false as const };

  const linkedRoute = Array.isArray(data.routes) ? data.routes[0] : data.routes;
  const routeName = linkedRoute?.name ?? "";
  return {
    ok: true as const,
    found: true as const,
    customer: {
      businessName: data.business_name || businessName,
      customerName: data.name || "",
      phone: data.phone || "",
      address: data.address || "",
      routeName: wholesaleRoutes.includes(routeName as (typeof wholesaleRoutes)[number]) ? routeName : "",
    },
  };
}

export async function createManualWholesaleOrder(input: ManualWholesaleOrderInput) {
  const businessName = input.businessName?.trim();
  const submittedCustomerName = input.customerName?.trim();
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;
  const routeName = input.routeName?.trim();
  const orderText = input.orderText?.trim();
  const notes = input.notes?.trim() || null;

  if (
    !businessName || businessName.length > 160 || (submittedCustomerName?.length ?? 0) > 160 ||
    (phone?.length ?? 0) > 40 || (address?.length ?? 0) > 500 ||
    !orderText || orderText.length > 5_000 || (notes?.length ?? 0) > 2_000 ||
    !wholesaleRoutes.includes(routeName as (typeof wholesaleRoutes)[number])
  ) {
    return { ok: false as const, message: "Revisa el establecimiento, la ruta y el pedido." };
  }

  const items = parseOrderText(orderText);
  if (!items.length) {
    return { ok: false as const, message: "No pude reconocer cantidades en el pedido. Usa formatos como “5 kg de costilla”." };
  }

  const supabase = await sessionClient();
  const identityKey = customerIdentityKey("wholesale", { businessName, name: submittedCustomerName || businessName, phone: phone ?? undefined });
  const [{ data: route, error: routeError }, { data: existingCustomer }] = await Promise.all([
    supabase.from("routes").select("id").eq("name", routeName).maybeSingle(),
    supabase.from("customers").select("name,phone,address,city,route_id").eq("customer_type", "wholesale").eq("identity_key", identityKey).maybeSingle(),
  ]);
  if (routeError || !route) return { ok: false as const, message: "La ruta seleccionada no está disponible." };
  const customerName = submittedCustomerName || existingCustomer?.name || businessName;
  const routeId = route.id;

  const { data: customer, error: customerError } = await supabase.from("customers").upsert({
    customer_type: "wholesale",
    identity_key: identityKey,
    name: customerName,
    business_name: businessName,
    phone: phone ?? existingCustomer?.phone ?? null,
    address: address ?? existingCustomer?.address ?? null,
    city: existingCustomer?.city || "Barranquilla",
    route_id: routeId,
  }, { onConflict: "customer_type,identity_key" }).select("id").single();
  if (customerError || !customer) return { ok: false as const, message: "No se pudo guardar el establecimiento." };

  const sourcePayload = {
    customer: { name: customerName, business_name: businessName, phone, address },
    manual_entry: { order_text: orderText },
  };
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    customer_type: "wholesale",
    customer_id: customer.id,
    route_id: routeId,
    source: "manual",
    source_payload: sourcePayload,
    status: "received",
    fulfillment_type: "delivery",
    delivery_address: address,
    subtotal: 0,
    notes,
  }).select("id,order_number").single();
  if (orderError || !order) return { ok: false as const, message: "No se pudo crear el pedido." };

  const { error: itemsError } = await supabase.from("order_items").insert(items.map((item, index) => ({
    order_id: order.id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit: item.unit,
    preparation: item.preparation ?? null,
    unit_price: 0,
    sort_order: index,
  })));
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { ok: false as const, message: "No se pudieron guardar los productos del pedido." };
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  return { ok: true as const, message: `${order.order_number} fue creado para ${businessName}.` };
}

export async function updateWholesalePayment(
  orderId: string,
  total: number,
  paymentStatus: "pending" | "paid",
  sendSummary = false,
) {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") {
    return { ok: false, message: "La cartera mayorista es exclusiva de administradores." };
  }
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
  const [pipeline, fields] = await Promise.all([
    syncWholesalePipeline(
      context,
      paymentStatus === "paid" ? "paid" : "payment_pending",
      `${customer?.name || "Cliente"} · ${data.order_number}`,
      total,
    ),
    syncHighLevelOrderFields(context, { orderNumber: data.order_number, total }),
  ]);
  if (sendSummary) {
    const sent = await sendWholesalePaymentSummary(context, customer?.name || "cliente", data.order_number, total);
    if (!sent.ok) return { ok: false, message: `Se guardó la cartera, pero ${sent.message}` };
  }
  revalidatePath("/dashboard");
  const synchronizationWarning = !pipeline.ok
    ? ` No se pudo mover el pipeline: ${pipeline.message}`
    : !fields.ok
      ? ` El pipeline se movió, pero ${fields.message}`
      : "";
  return { ok: true, message: `${sendSummary ? "Cartera actualizada y resumen enviado." : "Cartera actualizada."}${synchronizationWarning}` };
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
    unitPrice: number;
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
  const normalizedItems = details.items.map((item) => item.unit === "und"
    ? { ...item, unit: "und" }
    : { ...item, ...toKilograms(item.quantity, item.unit) });

  if (
    !customer ||
    !phone ||
    !address ||
    !details.items.length ||
    normalizedItems.some((item) =>
      !(/^\d+$/.test(item.id) || /^new-\d+(?:-\d+)?$/.test(item.id)) ||
      !item.productName.trim() ||
      !item.unit.trim() ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0 ||
      item.unitPrice > 999_999_999,
    )
  ) {
    return { ok: false, message: "Revisa los datos del cliente y las cantidades del pedido." };
  }

  const supabase = await sessionClient();
  const { data: order, error: lookupError } = await supabase
    .from("orders")
    .select("customer_id,customer_type")
    .eq("id", Number(orderId))
    .single();

  if (lookupError || !order) {
    return { ok: false, message: "No se encontró el pedido para editar." };
  }

  const { data: existingItems, error: itemsLookupError } = await supabase
    .from("order_items")
    .select("id,product_id,product_name")
    .eq("order_id", Number(orderId));
  if (itemsLookupError) return { ok: false, message: "No se pudieron consultar los productos del pedido." };
  const existingIds = new Set((existingItems ?? []).map((item) => String(item.id)));
  const keptIds = new Set(normalizedItems.filter((item) => /^\d+$/.test(item.id)).map((item) => item.id));
  if ([...keptIds].some((id) => !existingIds.has(id))) return { ok: false, message: "Uno de los productos ya no pertenece al pedido." };
  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  const currentItems = normalizedItems.filter((item) => /^\d+$/.test(item.id));
  const newItems = normalizedItems.filter((item) => !/^\d+$/.test(item.id));
  const existingById = new Map((existingItems ?? []).map((item) => [String(item.id), item]));
  const subtotal = normalizedItems.reduce((total, item) => total + Math.round(item.quantity * item.unitPrice), 0);

  const [customerResult, orderResult, deleteResult, insertResult, ...itemResults] = await Promise.all([
    supabase
      .from("customers")
      .update({
        name: customer,
        phone,
        address,
        ...(order.customer_type === "retail" ? { identity_key: customerIdentityKey("retail", { name: customer, phone }) } : {}),
      })
      .eq("id", Number(order.customer_id)),
    supabase
      .from("orders")
      .update({
        delivery_address: address,
        notes: notes || null,
        subtotal,
      })
      .eq("id", Number(orderId)),
    removedIds.length
      ? supabase.from("order_items").delete().in("id", removedIds).eq("order_id", Number(orderId))
      : Promise.resolve({ error: null }),
    newItems.length
      ? supabase.from("order_items").insert(newItems.map((item, index) => ({
          order_id: Number(orderId),
          product_name: item.productName.trim(),
          quantity: item.quantity,
          actual_quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          preparation: item.preparation.trim() || null,
          sort_order: (existingItems?.length ?? 0) + index,
        })))
      : Promise.resolve({ error: null }),
    ...currentItems.map((item) =>
      supabase
        .from("order_items")
        .update({
          // Al renombrar manualmente no se debe conservar la referencia al producto anterior.
          product_id: normalizeProductName(existingById.get(item.id)?.product_name ?? "") === normalizeProductName(item.productName)
            ? existingById.get(item.id)?.product_id ?? null
            : null,
          product_name: item.productName.trim(),
          actual_quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          preparation: item.preparation.trim() || null,
        })
        .eq("id", Number(item.id))
        .eq("order_id", Number(orderId)),
    ),
  ]);

  if (customerResult.error || orderResult.error || deleteResult.error || insertResult.error || itemResults.some((result) => result.error)) {
    return { ok: false, message: "No se pudieron guardar todos los cambios." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Pedido actualizado." };
}

type WholesaleTableRowInput = {
  orderId: string;
  routeName: string;
  notes: string;
  quantities: Array<{ productName: string; value: string }>;
};

function parseQuantity(value: string) {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*([\p{L}]+)?$/u);
  if (!match) return null;
  const quantity = Number(match[1].replace(",", "."));
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  return { quantity, unit: normalizeWholesaleUnit(match[2] ?? UNSPECIFIED_WHOLESALE_UNIT) };
}

function parseWholesaleCell(productName: string, value: string) {
  const normalizedProduct = normalizeProductName(productName);
  if (normalizedProduct === "comodin") {
    const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return null;
    const parsed = parts.map((part) => {
      const match = part.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilo|kilos|lb|lbs|libra|libras|und|unds|unidad|unidades)?\s+(.+)$/i);
      if (!match) return null;
      const quantity = Number(match[1].replace(",", "."));
      const preparation = match[3].trim();
      if (!Number.isFinite(quantity) || quantity <= 0 || !preparation) return null;
      return { quantity, unit: normalizeWholesaleUnit(match[2] ?? UNSPECIFIED_WHOLESALE_UNIT), preparation: preparation.slice(0, 250) };
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
    const match = part.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilo|kilos|lb|lbs|libra|libras|und|unds|unidad|unidades)?\s*([CLTB])?$/i);
    if (!match) return null;
    const quantity = Number(match[1].replace(",", "."));
    if (!Number.isFinite(quantity) || quantity < 0) return null;
    return { quantity, unit: normalizeWholesaleUnit(match[2] ?? UNSPECIFIED_WHOLESALE_UNIT), preparation: match[3]?.toUpperCase() ?? null };
  });
  return parsed.every(Boolean) ? parsed as Array<{ quantity: number; unit: string; preparation: string | null }> : null;
}

function sameProduct(left: { product_name: string; preparation?: string | null }, right: string) {
  const leftCatalog = catalogProductFor(left.product_name)?.name;
  const rightCatalog = catalogProductFor(right)?.name;
  if (!rightCatalog) {
    const leftName = leftCatalog === "Comodín" && left.preparation ? left.preparation : left.product_name;
    return normalizeProductName(leftName) === normalizeProductName(right);
  }
  if (normalizeProductName(rightCatalog ?? right) === "comodin") {
    return !leftCatalog || normalizeProductName(leftCatalog) === "comodin";
  }
  return normalizeProductName(leftCatalog ?? left.product_name) === normalizeProductName(rightCatalog ?? right);
}

export async function updateWholesaleTable(rows: WholesaleTableRowInput[]) {
  if (!Array.isArray(rows) || rows.length > 200) {
    return { ok: false, message: "La edición de la tabla no es válida." };
  }

  for (const row of rows) {
    if (
      !/^\d+$/.test(row.orderId) ||
      typeof row.routeName !== "string" ||
      !row.routeName.trim() ||
      row.routeName.length > 120 ||
      typeof row.notes !== "string" ||
      row.notes.length > 2_000 ||
      !Array.isArray(row.quantities) ||
      row.quantities.length > 100 ||
      row.quantities.some(({ productName, value }) =>
        !productName.trim() || productName.length > 120 || value.length > 80 || (value.trim() && !parseWholesaleCell(productName, value)),
      )
    ) {
      return { ok: false, message: "Revisa las cantidades. Usa valores como “1,5”, “2 kg” o “0” cuando la cantidad está por definir." };
    }
  }

  const supabase = await sessionClient();

  for (const row of rows) {
    const orderId = Number(row.orderId);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,customer_id")
      .eq("id", orderId)
      .eq("customer_type", "wholesale")
      .maybeSingle();

    if (orderError || !order) return { ok: false, message: "No se encontró un pedido mayorista para editar." };

    const { data: existingItems, error: lookupError } = await supabase
      .from("order_items")
      .select("id,product_name,unit,preparation")
      .eq("order_id", orderId);

    if (lookupError) return { ok: false, message: "No se pudo consultar el pedido para editarlo." };

    const { data: route, error: routeError } = await supabase.from("routes").select("id").eq("name", row.routeName.trim()).maybeSingle();
    if (routeError || !route) return { ok: false, message: "Selecciona una ruta válida para cada cliente." };

    const [orderUpdate, customerUpdate] = await Promise.all([
      supabase.from("orders").update({ notes: row.notes.trim() || null, route_id: route.id }).eq("id", orderId),
      supabase.from("customers").update({ route_id: route.id }).eq("id", order.customer_id).eq("customer_type", "wholesale"),
    ]);

    if (orderUpdate.error || customerUpdate.error) return { ok: false, message: "No se pudo guardar la ruta o el comentario." };

    for (const entry of row.quantities) {
      const matching = (existingItems ?? []).filter((item) => sameProduct(item, entry.productName));
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
  return { ok: true, message: "La tabla, las rutas y los comentarios fueron actualizados." };
}
