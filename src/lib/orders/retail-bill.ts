type RetailBillItem = {
  productName: string;
  quantity: number;
  actualQuantity?: number;
  unit: string;
  unitPrice: number;
};

type RetailBillOrder = {
  orderNumber: string;
  customer: string;
  receivedAt: string;
  paymentStatus: string;
  deliveryFee: number;
  adjustments: number;
  items: RetailBillItem[];
};

type RetailDispatchOrder = {
  orderNumber: string;
  customer: string;
  fulfillment: "delivery" | "pickup";
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });
const dateTime = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export function retailItemQuantity(item: RetailBillItem) {
  return item.actualQuantity ?? item.quantity;
}

export function retailBillableQuantity(item: RetailBillItem) {
  return item.actualQuantity ?? (item.unit === "kg" ? item.quantity : 0);
}

export function retailItemHasPendingWeight(item: RetailBillItem) {
  return item.actualQuantity == null && item.unit !== "kg";
}

export function retailItemHasPendingPrice(item: RetailBillItem) {
  return !Number.isFinite(item.unitPrice) || item.unitPrice <= 0;
}

export function retailLineSubtotal(item: RetailBillItem) {
  if (retailItemHasPendingPrice(item) || retailItemHasPendingWeight(item)) return null;
  // Los valores se expresan en COP sin centavos. Redondear cada línea evita
  // residuos de coma flotante al trabajar con pesos de hasta tres decimales.
  return Math.round(retailBillableQuantity(item) * item.unitPrice);
}

export function retailOrderSubtotal(items: RetailBillItem[]) {
  return items.reduce((total, item) => total + (retailLineSubtotal(item) ?? 0), 0);
}

export function retailOrderHasPendingValues(items: RetailBillItem[]) {
  return items.some((item) => retailLineSubtotal(item) == null);
}

function itemUnit(item: RetailBillItem) {
  return item.unit === "und" ? "und" : "kg";
}

function isPaid(status: string) {
  return ["paid", "verified", "pagado", "verificado"].includes(status.toLocaleLowerCase("es"));
}

export function retailBillMessage(order: RetailBillOrder) {
  const subtotal = retailOrderSubtotal(order.items);
  const total = subtotal + order.deliveryFee + order.adjustments;
  const lines = order.items.map((item) => retailItemHasPendingPrice(item)
    ? `• ${item.productName}: precio pendiente`
    : retailItemHasPendingWeight(item)
    ? `• ${item.productName}: ${quantity.format(item.quantity)} und · peso pendiente`
    : `• ${item.productName}: ${quantity.format(retailItemQuantity(item))} ${itemUnit(item)} × ${money.format(item.unitPrice)}/${itemUnit(item)} = ${money.format(retailLineSubtotal(item) ?? 0)}`);
  const pendingValues = retailOrderHasPendingValues(order.items);
  return [
    `Hola ${order.customer}, te compartimos la cuenta de tu pedido ${order.orderNumber} en Fénix J.A. (${dateTime.format(new Date(order.receivedAt))}):`,
    "",
    ...lines,
    "",
    `Subtotal: ${money.format(subtotal)}`,
    ...(order.deliveryFee > 0 ? [`Domicilio: ${money.format(order.deliveryFee)}`] : []),
    ...(order.adjustments !== 0 ? [`Ajustes: ${money.format(order.adjustments)}`] : []),
    pendingValues ? "*Total pendiente de completar pesos y precios*" : `*Total a pagar: ${money.format(total)}*`,
    "",
    isPaid(order.paymentStatus) ? "Este pedido ya figura como pagado. ¡Gracias por tu compra!" : "Quedamos atentos a tu pago y al comprobante. ¡Gracias por tu compra!",
  ].join("\n");
}

export function retailDispatchMessage(order: RetailDispatchOrder) {
  return order.fulfillment === "pickup"
    ? `Hola ${order.customer}, tu pedido ${order.orderNumber} ya está listo para recoger en Fénix J.A.`
    : `Hola ${order.customer}, tu pedido ${order.orderNumber} ya salió a despacho. Te avisaremos si se presenta alguna novedad.`;
}
