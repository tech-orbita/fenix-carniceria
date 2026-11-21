export type WholesalePortalItem = {
  product_name: string;
  quantity: number;
  unit: "cantidad" | "kg" | "lb" | "und";
  preparation?: string;
  notes?: string;
};

export type WholesalePortalOrder = {
  idempotencyKey: string;
  requestedDeliveryDate: string;
  notes?: string;
  items: WholesalePortalItem[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const units = new Set(["cantidad", "kg", "lb", "und"]);

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function bogotaDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function validateWholesalePortalOrder(value: unknown): WholesalePortalOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("No pudimos leer el pedido.");
  const record = value as Record<string, unknown>;
  const idempotencyKey = cleanText(record.idempotencyKey, 60);
  const requestedDeliveryDate = cleanText(record.requestedDeliveryDate, 10);
  const notes = cleanText(record.notes, 2_000);
  if (!uuidPattern.test(idempotencyKey)) throw new Error("El identificador del envío no es válido.");
  if (!datePattern.test(requestedDeliveryDate)) throw new Error("Selecciona una fecha de entrega válida.");
  const today = bogotaDate();
  const latest = new Date(`${today}T12:00:00-05:00`);
  latest.setUTCDate(latest.getUTCDate() + 90);
  if (requestedDeliveryDate < today || requestedDeliveryDate > bogotaDate(latest)) {
    throw new Error("La fecha de entrega debe estar entre hoy y los próximos 90 días.");
  }
  if (!Array.isArray(record.items) || record.items.length < 1 || record.items.length > 50) {
    throw new Error("Agrega entre 1 y 50 renglones de productos.");
  }
  const items = record.items.map((value, index): WholesalePortalItem => {
    const item = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const productName = cleanText(item.productName ?? item.product_name, 160);
    const quantity = Number(item.quantity);
    const unit = cleanText(item.unit, 12);
    if (!productName) throw new Error(`Escribe el producto del renglón ${index + 1}.`);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000) {
      throw new Error(`Escribe una cantidad válida en el renglón ${index + 1}.`);
    }
    if (!units.has(unit)) throw new Error(`Selecciona la unidad del renglón ${index + 1}.`);
    return {
      product_name: productName,
      quantity,
      unit: unit as WholesalePortalItem["unit"],
      preparation: cleanText(item.preparation, 250) || undefined,
      notes: cleanText(item.notes, 500) || undefined,
    };
  });
  return { idempotencyKey, requestedDeliveryDate, notes: notes || undefined, items };
}

export function wholesaleOrderText(items: WholesalePortalItem[]) {
  return items.map((item) => [item.quantity, item.unit === "cantidad" ? "" : item.unit, item.product_name, item.preparation].filter(Boolean).join(" ")).join("\n");
}

export function safeUploadName(value: string) {
  const extension = value.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const base = value.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "comprobante";
  return `${base}.${extension.slice(0, 8)}`;
}

