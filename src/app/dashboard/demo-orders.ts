import type { Order } from "./types";

const bogotaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function demoOrders(): Order[] {
  const today = bogotaDay.format(new Date());
  const base = {
    customerType: "wholesale" as const,
    deliveryDate: "Sin fecha",
    fulfillment: "delivery" as const,
    source: "form" as const,
    paymentMethod: "credit",
    paymentStatus: "pending",
    deliveryFee: 0,
    adjustments: 0,
    highLevel: {},
  };
  return [
    {
      ...base,
      id: "9001", orderNumber: "DEMO-001", customer: "María Pérez", businessName: "Restaurante La Esquina", phone: "+57 300 111 2233",
      receivedAt: `${today}T01:30:00-05:00`, address: "Centro, Barranquilla", route: "Centro", status: "received", total: 385000,
      notes: "Entregar antes de las 10 a. m.",
      items: [
        { id: "9101", productName: "Blanda", quantity: 10, unit: "lb", preparation: "C", unitPrice: 0 },
        { id: "9102", productName: "Blanda", quantity: 4, unit: "kg", preparation: "L", unitPrice: 0 },
        { id: "9103", productName: "Costilla cerdo", quantity: 8, unit: "kg", unitPrice: 0 },
      ],
      formData: { form: "mayorista-cliente", order_text: "10 lb capón, 4 kg lomo y 8 kg costilla de cerdo", billing: "Cuenta de cobro" },
    },
    {
      ...base,
      id: "9002", orderNumber: "DEMO-002", customer: "Carlos Díaz", businessName: "Tienda El Norte", phone: "+57 301 444 5566",
      receivedAt: `${today}T02:40:00-05:00`, address: "Norte, Barranquilla", route: "Norte", status: "incident", total: 210000,
      notes: "Confirmar dirección antes de despachar.",
      items: [
        { id: "9201", productName: "Molida especial", quantity: 6, unit: "kg", unitPrice: 0 },
        { id: "9202", productName: "Pechuga congela", quantity: 12, unit: "kg", unitPrice: 0 },
      ],
      formData: { form: "nuevo-mayorista", order_text: "6 kg molida especial y 12 kg pechuga congelada", billing: "No" },
    },
    {
      ...base,
      id: "9003", orderNumber: "DEMO-003", customer: "Sofía Gómez", businessName: "Asados del Sur", phone: "+57 302 777 8899",
      receivedAt: `${today}T04:15:00-05:00`, address: "Sur, Barranquilla", route: "Sur", status: "received", total: 460000,
      items: [
        { id: "9301", productName: "Lomo fino", quantity: 7, unit: "kg", unitPrice: 0 },
        { id: "9302", productName: "Comodín", quantity: 2, unit: "kg", preparation: "Corte especial", unitPrice: 0 },
      ],
      formData: { form: "mayorista-cliente", order_text: "7 kg lomo fino y 2 kg de corte especial", billing: "Electrónica" },
    },
    {
      ...base,
      id: "9004", orderNumber: "DEMO-AYUDA-001", customer: "Luis Mendoza", businessName: "Distribuidora San José", phone: "+57 300 888 2211",
      receivedAt: `${today}T10:30:00-05:00`, address: "Calle 45 # 18-20, Barranquilla", route: "Sin clasificar", source: "agent", status: "incident", total: 0,
      notes: "El cliente solicita ayuda para realizar su primer pedido mayorista.",
      items: [],
    },
    {
      id: "9401", orderNumber: "DEMO-MIN-001", customerType: "retail", customer: "Laura Martínez", phone: "+57 300 555 0101",
      receivedAt: `${today}T09:20:00-05:00`, deliveryDate: today, fulfillment: "delivery", address: "Barrio El Prado, Barranquilla", route: "Norte",
      source: "agent", paymentMethod: "transfer", paymentStatus: "pending", deliveryFee: 0, adjustments: 0, total: 128_000, status: "received",
      highLevel: { contactId: "demo-contact-1", locationId: "demo-location", conversationId: "demo-conversation-1" },
      items: [
        { id: "94011", productName: "Punta gorda", quantity: 2, unit: "kg", unitPrice: 39_000, notes: "punta gorda 2 kilos" },
        { id: "94012", productName: "Sobre barriga delgada", quantity: 1, unit: "kg", unitPrice: 29_000, notes: "sobrebarriga 2 libras" },
        { id: "94013", productName: "Muslo Colombina", quantity: 1, unit: "kg", unitPrice: 10_000, notes: "muslo colombia 4" },
        { id: "94014", productName: "Ala especial", quantity: 1, unit: "kg", unitPrice: 11_000, notes: "ala especial 5 alas" },
      ],
    },
    {
      id: "9402", orderNumber: "DEMO-MIN-002", customerType: "retail", customer: "Andrés Ruiz", phone: "+57 301 555 0202",
      receivedAt: `${today}T10:05:00-05:00`, deliveryDate: today, fulfillment: "delivery", address: "Barrio Boston, Barranquilla", route: "Centro",
      source: "agent", paymentMethod: "cash", paymentStatus: "pending", deliveryFee: 0, adjustments: 0, total: 20_000, status: "incident",
      highLevel: { contactId: "demo-contact-2", locationId: "demo-location", conversationId: "demo-conversation-2" },
      notes: "El cliente pidió ayuda para corregir la dirección.",
      items: [
        { id: "94021", productName: "Costilla de cerdo", quantity: 1, unit: "kg", unitPrice: 20_000 },
      ],
    },
  ];
}
