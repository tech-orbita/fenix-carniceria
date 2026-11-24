export type WholesalePortalOrder = {
  idempotencyKey: string;
  businessName: string;
  phone: string;
  orderText: string;
  notes?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function validateWholesalePortalOrder(value: unknown): WholesalePortalOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("No pudimos leer el pedido.");
  const record = value as Record<string, unknown>;
  const idempotencyKey = cleanText(record.idempotencyKey, 60);
  const businessName = cleanText(record.businessName, 160);
  const phone = cleanText(record.phone, 30);
  const orderText = cleanText(record.orderText, 6_000);
  const notes = cleanText(record.notes, 2_000);
  if (!uuidPattern.test(idempotencyKey)) throw new Error("El identificador del envío no es válido.");
  if (!businessName) throw new Error("Escribe el nombre del establecimiento.");
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 8 || phoneDigits.length > 15) throw new Error("Escribe un teléfono válido.");
  if (!orderText) throw new Error("Escribe al menos un producto.");
  return { idempotencyKey, businessName, phone, orderText, notes: notes || undefined };
}

