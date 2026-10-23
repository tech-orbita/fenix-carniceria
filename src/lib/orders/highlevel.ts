import { parseOrderText } from "./product-parser.ts";

export type WholesaleForm = "mayorista-cliente" | "nuevo-mayorista";

const normalize = (key: string) => key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapHighLevelForm(value: unknown, form: WholesaleForm) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El webhook debe contener un objeto JSON");
  const payload = value as Record<string, unknown>;
  const fields = new Map<string, unknown>();
  function collect(record: Record<string, unknown>) {
    for (const [key, value] of Object.entries(record)) {
      fields.set(normalize(key.replace(/^contact\./, "")), value);
    }
  }
  collect(payload);
  for (const key of ["contact", "customFields", "custom_fields", "customData", "custom_data"]) {
    const nested = payload[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) collect(nested as Record<string, unknown>);
    if (Array.isArray(nested)) for (const entry of nested) {
      if (entry && typeof entry === "object") {
        const field = entry as Record<string, unknown>;
        const name = field.key ?? field.name;
        if (typeof name === "string") fields.set(normalize(name.replace(/^contact\./, "")), field.value);
      }
    }
  }
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = fields.get(normalize(key));
      if (typeof value === "string" && value.trim() && !value.includes("{{")) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return undefined;
  };
  const name = get("customer_name", "Nombre Completo", "full_name", "name") ?? [get("first_name"), get("last_name")].filter(Boolean).join(" ");
  const business = get("business_name", "Nombre del Negocio", "company_name");
  const phone = get("phone", "Teléfono");
  const text = get("order_text", "Coloca tu Pedido", "coloca_tu_pedido");
  const fulfillment = get("fulfillment_type", "¿Es a Domicilio o Recoges en Tienda?", "es_a_domicilio_o_recoges_en_tienda");
  if (!phone || !(name || business) || !text) throw new Error("Faltan nombre o negocio, teléfono o Coloca tu Pedido");
  if (!fulfillment || !["delivery", "domicilio", "pickup", "tienda"].includes(fulfillment.toLowerCase())) throw new Error("Entrega debe ser Domicilio o Tienda");
  if (form === "nuevo-mayorista" && !business) throw new Error("Falta Nombre del Negocio");
  const submission = get("submission_id", "submissionId", "event_id");
  return {
    source: "form" as const,
    source_reference: submission ? `ghl:${form}:${submission}` : undefined,
    customer_type: "wholesale" as const,
    customer: {
      name: name || business!, phone: phone.replace(/[\s()-]/g, ""), business_name: business,
      tax_id: get("tax_id", "Nit o Cédula"), email: get("email"),
      address: get("address", "Dirección", "address1"),
    },
    fulfillment_type: ["pickup", "tienda"].includes(fulfillment.toLowerCase()) ? "pickup" as const : "delivery" as const,
    route: get("zone", "Zona"),
    notes: get("observations", "Observaciones Adicionales"),
    items: parseOrderText(text),
    form_data: {
      form, order_text: text, tax_id: get("tax_id", "Nit o Cédula"), billing: get("billing", "Facturación"),
      maps_url: get("maps_url", "Ubicación de Maps"),
      receiver_phone: get("receiver_phone", "Número de Quien Recibe"),
      payment_proof: get("payment_proof", "Aqui puedes subir tu comprobante de Pago"),
      contact_id: get("contactId", "contact_id"),
      location_id: get("locationId", "location_id"),
      conversation_id: get("conversationId", "conversation_id"),
      conversation_url: get("conversationUrl", "conversation_url"),
      original_payload: payload,
    },
  };
}
