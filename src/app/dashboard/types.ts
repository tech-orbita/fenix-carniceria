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
  total: number;
  status: OrderStatus;
  items: OrderItem[];
  formData?: { form: string; order_text: string; tax_id?: string; billing?: string; maps_url?: string; receiver_phone?: string; payment_proof?: string; contact_id?: string; location_id?: string; conversation_id?: string; conversation_url?: string };
  highLevel?: { contactId?: string; locationId?: string; conversationId?: string; conversationUrl?: string };
  notes?: string;
};
