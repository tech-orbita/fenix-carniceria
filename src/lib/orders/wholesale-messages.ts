type WholesaleDispatchOrder = {
  orderNumber: string;
  customer: string;
};

export function wholesaleDispatchMessage(order: WholesaleDispatchOrder) {
  return `Buenas noticias, ${order.customer}. Tu pedido ${order.orderNumber} ya va en camino. Esperamos que lo recibas a satisfacción. Gracias por seguir confiando en Fénix.`;
}
