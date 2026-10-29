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

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });
const dateTime = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

function itemQuantity(item: RetailBillItem) {
  return item.actualQuantity ?? item.quantity;
}

function billableQuantity(item: RetailBillItem) {
  return item.actualQuantity ?? (item.unit === "kg" ? item.quantity : 0);
}

function pendingWeight(item: RetailBillItem) {
  return item.actualQuantity == null && item.unit !== "kg";
}

function isPaid(status: string) {
  return ["paid", "verified", "pagado", "verificado"].includes(status.toLocaleLowerCase("es"));
}

export function retailBillMessage(order: RetailBillOrder) {
  const subtotal = order.items.reduce((total, item) => total + billableQuantity(item) * item.unitPrice, 0);
  const total = subtotal + order.deliveryFee + order.adjustments;
  const lines = order.items.map((item) => pendingWeight(item)
    ? `• ${item.productName}: ${quantity.format(item.quantity)} und · peso pendiente`
    : `• ${item.productName}: ${quantity.format(itemQuantity(item))} kg × ${money.format(item.unitPrice)} = ${money.format(billableQuantity(item) * item.unitPrice)}`);
  return [
    `Hola ${order.customer}, te compartimos la cuenta de tu pedido ${order.orderNumber} en Fénix J.A. (${dateTime.format(new Date(order.receivedAt))}):`,
    "",
    ...lines,
    "",
    `Subtotal: ${money.format(subtotal)}`,
    ...(order.deliveryFee > 0 ? [`Domicilio: ${money.format(order.deliveryFee)}`] : []),
    ...(order.adjustments !== 0 ? [`Ajustes: ${money.format(order.adjustments)}`] : []),
    `*Total a pagar: ${money.format(total)}*`,
    "",
    isPaid(order.paymentStatus) ? "Este pedido ya figura como pagado. ¡Gracias por tu compra!" : "Quedamos atentos a tu pago y al comprobante. ¡Gracias por tu compra!",
  ].join("\n");
}
