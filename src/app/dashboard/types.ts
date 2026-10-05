export type CustomerType = "retail" | "wholesale";

export type OrderStatus =
  | "needs_review"
  | "received"
  | "quoted"
  | "confirmed"
  | "preparing"
  | "ready"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "incident";

export type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  actualQuantity?: number;
  preparation?: string;
  unitPrice: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerType: CustomerType;
  customer: string;
  businessName?: string;
  phone: string;
  receivedAt: string;
  deliveryDate: string;
  fulfillment: "delivery" | "pickup";
  address: string;
  route: string;
  source: "form" | "agent" | "manual";
  paymentMethod?: string;
  paymentStatus: string;
  deliveryFee: number;
  adjustments: number;
  status: OrderStatus;
  items: OrderItem[];
  notes?: string;
};

export const demoOrders: Order[] = [
  {
    id: "demo-1048",
    orderNumber: "FEN-001048",
    customerType: "retail",
    customer: "María Fernanda",
    phone: "+57 310 245 8091",
    receivedAt: "2026-10-05T12:42:00-05:00",
    deliveryDate: "2026-10-06",
    fulfillment: "delivery",
    address: "Cra. 32 # 18-45, Apto. 301",
    route: "Sur",
    source: "form",
    paymentMethod: "Transferencia",
    paymentStatus: "Comprobante recibido",
    deliveryFee: 0,
    adjustments: 0,
    status: "received",
    items: [
      { id: "i1", productName: "Punta de anca", quantity: 2, unit: "lb", preparation: "4 porciones de ½ lb", unitPrice: 29000 },
      { id: "i2", productName: "Costilla de cerdo", quantity: 1, unit: "lb", preparation: "En trozos medianos", unitPrice: 18000 },
    ],
    notes: "Empacar cada porción por separado.",
  },
  {
    id: "demo-1047",
    orderNumber: "FEN-001047",
    customerType: "retail",
    customer: "Carlos Ramírez",
    phone: "+57 300 688 1452",
    receivedAt: "2026-10-05T12:31:00-05:00",
    deliveryDate: "2026-10-05",
    fulfillment: "pickup",
    address: "Punto físico",
    route: "Punto físico",
    source: "agent",
    paymentMethod: "Efectivo",
    paymentStatus: "Pendiente",
    deliveryFee: 0,
    adjustments: 0,
    status: "preparing",
    items: [
      { id: "i3", productName: "Carne molida especial", quantity: 2, unit: "lb", preparation: "Paquetes de 1 lb", unitPrice: 18000 },
      { id: "i4", productName: "Hueso carnudo", quantity: 1, unit: "lb", unitPrice: 12200 },
    ],
  },
  {
    id: "demo-1046",
    orderNumber: "FEN-001046",
    customerType: "retail",
    customer: "Juliana Gómez",
    phone: "+57 315 427 9033",
    receivedAt: "2026-10-05T12:18:00-05:00",
    deliveryDate: "2026-10-05",
    fulfillment: "delivery",
    address: "Calle 14 # 8-22",
    route: "Centro",
    source: "agent",
    paymentMethod: "Contraentrega",
    paymentStatus: "Pendiente",
    deliveryFee: 0,
    adjustments: 0,
    status: "ready",
    items: [
      { id: "i5", productName: "Lomo fino", quantity: 2, unit: "lb", preparation: "Medallones", unitPrice: 25000 },
      { id: "i6", productName: "Morcilla", quantity: 1, unit: "lb", unitPrice: 12000 },
    ],
  },
  {
    id: "demo-2042",
    orderNumber: "FEN-002042",
    customerType: "wholesale",
    customer: "Restaurante Monserrate",
    businessName: "Monserrate",
    phone: "+57 301 440 8200",
    receivedAt: "2026-10-05T20:15:00-05:00",
    deliveryDate: "2026-10-06",
    fulfillment: "delivery",
    address: "Centro histórico",
    route: "Centro",
    source: "form",
    paymentMethod: "Crédito",
    paymentStatus: "Crédito",
    deliveryFee: 0,
    adjustments: 0,
    status: "confirmed",
    items: [
      { id: "i7", productName: "Blanda", quantity: 10, unit: "lb", unitPrice: 16000 },
      { id: "i8", productName: "Costilla", quantity: 7, unit: "lb", unitPrice: 11300 },
      { id: "i9", productName: "Hueso", quantity: 5, unit: "lb", unitPrice: 4000 },
    ],
  },
  {
    id: "demo-2041",
    orderNumber: "FEN-002041",
    customerType: "wholesale",
    customer: "Tienda La Hormiga",
    businessName: "La Hormiga",
    phone: "+57 300 920 4410",
    receivedAt: "2026-10-05T19:48:00-05:00",
    deliveryDate: "2026-10-06",
    fulfillment: "delivery",
    address: "Soledad",
    route: "Soledad",
    source: "agent",
    paymentMethod: "Transferencia",
    paymentStatus: "Verificado",
    deliveryFee: 0,
    adjustments: 0,
    status: "preparing",
    items: [
      { id: "i10", productName: "Pollo / atravesado", quantity: 9, unit: "lb", unitPrice: 15100 },
      { id: "i11", productName: "Molida especial", quantity: 10, unit: "lb", unitPrice: 14200 },
      { id: "i12", productName: "Lengüeta / jarretón", quantity: 12, unit: "lb", unitPrice: 11300 },
    ],
  },
  {
    id: "demo-2040",
    orderNumber: "FEN-002040",
    customerType: "wholesale",
    customer: "Asados La 36",
    businessName: "Asados La 36",
    phone: "+57 310 210 1188",
    receivedAt: "2026-10-05T19:20:00-05:00",
    deliveryDate: "2026-10-06",
    fulfillment: "delivery",
    address: "Barrio El Prado",
    route: "Norte",
    source: "form",
    paymentMethod: "Crédito",
    paymentStatus: "Crédito",
    deliveryFee: 0,
    adjustments: 0,
    status: "received",
    items: [
      { id: "i13", productName: "Blanda", quantity: 8, unit: "lb", unitPrice: 16000 },
      { id: "i14", productName: "Hígado", quantity: 4, unit: "lb", unitPrice: 9750 },
      { id: "i15", productName: "Corazón", quantity: 3, unit: "lb", unitPrice: 10000 },
    ],
  },
];
