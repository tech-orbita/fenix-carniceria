type WholesaleMessageOrder = {
  orderNumber: string;
  customer: string;
};

export function wholesaleOrderConfirmationMessage(order: WholesaleMessageOrder) {
  return `Hola, ${order.customer}.\n\nHemos recibido correctamente tu pedido en Fénix J.A.\nNúmero de pedido: ${order.orderNumber}\n\nNuestro equipo revisará la solicitud para organizar su despacho. Gracias por confiar en nosotros.`;
}

export function wholesaleDispatchMessage(order: WholesaleMessageOrder) {
  return `Buenas noticias, ${order.customer}. Tu pedido ${order.orderNumber} ya va en camino. Esperamos que lo recibas a satisfacción. Gracias por seguir confiando en Fénix.`;
}
