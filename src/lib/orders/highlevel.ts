import { parseOrderText } from "./product-parser.ts";

export type WholesaleForm = "mayorista-cliente" | "nuevo-mayorista";

const normalize = (key: string) => key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

function canonicalZone(value?: string) {
  if (!value) return undefined;
  const normalized = normalize(value);
  // Solo normalizamos equivalencias exactas conocidas. Las opciones del formulario
  // pueden cambiar y sus etiquetas deben llegar intactas al panel (por ejemplo,
  // "Barranquilla Norte" o una zona nueva), sin reducirlas por coincidencias parciales.
  const zones: Array<[string, string]> = [
    ["soledad", "Soledad"],
    ["centro", "Centro"],
    ["norte", "Norte"],
    ["sur", "Sur"],
    ["galapa", "Galapa"],
    ["sinclasificar", "Sin clasificar"],
  ];
  return zones.find(([key]) => normalized === key)?.[1] ?? value.trim().slice(0, 80);
}

export function mapHighLevelForm(value: unknown, form: WholesaleForm) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El webhook debe contener un objeto JSON");
  const payload = value as Record<string, unknown>;
  const fields = new Map<string, unknown>();
  function put(key: string, value: unknown) {
    const normalized = normalize(key);
    if (!fields.has(normalized)) fields.set(normalized, value);
    if (/^contact\./i.test(key)) {
      const withoutContact = normalize(key.replace(/^contact\./i, ""));
      if (!fields.has(withoutContact)) fields.set(withoutContact, value);
    }
  }
  function collect(record: Record<string, unknown>, prefix = "", depth = 0) {
    if (depth > 5) return;
    for (const [key, value] of Object.entries(record)) {
      put(key, value);
      if (prefix) put(`${prefix}.${key}`, value);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const field = value as Record<string, unknown>;
        const name = field.key ?? field.fieldKey ?? field.name ?? field.label;
        if (typeof name === "string" && "value" in field) put(name, field.value);
        collect(field, prefix ? `${prefix}.${key}` : key, depth + 1);
      }
      if (Array.isArray(value)) for (const entry of value) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const field = entry as Record<string, unknown>;
        const name = field.key ?? field.fieldKey ?? field.name ?? field.label;
        if (typeof name === "string") put(name, field.value);
        collect(field, prefix ? `${prefix}.${key}` : key, depth + 1);
      }
    }
  }
  collect(payload);
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = fields.get(normalize(key));
      if (typeof value === "string" && value.trim() && !value.includes("{{")) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return undefined;
  };
  const getFileUrl = (...keys: string[]) => {
    const direct = get(...keys);
    if (direct) return direct;
    for (const key of keys) {
      const value = fields.get(normalize(key));
      if (Array.isArray(value)) {
        const url = value.find((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
        if (url) return url.trim();
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const file = value as Record<string, unknown>;
        const url = file.url ?? file.fileUrl ?? file.file_url;
        if (typeof url === "string" && url.trim()) return url.trim();
      }
    }
    return undefined;
  };
  // Los formularios nuevos envían la persona y la empresa por separado. Se
  // conservan los alias anteriores para que los flujos históricos sigan
  // funcionando mientras todos los contactos se actualizan.
  const name = get("full_name", "Nombre Completo", "customer_name", "contact.name", "name") ?? [get("first_name", "contact.first_name"), get("last_name", "contact.last_name")].filter(Boolean).join(" ");
  const businessKeys = [
    "business_name", "Business_name", "Nombre del Negocio", "nombre_del_negocio",
    "contact.nombre_del_negocio", "company_name", "contact.company_name", "companyName",
  ];
  const hasExplicitBusinessField = businessKeys.some((key) => fields.has(normalize(key)));
  const business = get(...businessKeys)
    // Compatibilidad con el formulario anterior, que usaba el nombre del
    // contacto como negocio. Si el flujo nuevo envía el campo vacío, no se
    // debe inventar una empresa copiando el nombre de la persona.
    ?? (form === "nuevo-mayorista" && !hasExplicitBusinessField ? name : undefined);
  const phone = get("phone", "Teléfono", "contact.phone");
  const text = get("order_text", "Coloca tu Pedido", "coloca_tu_pedido", "Pedido", "pedido_mayorista");
  const fulfillment = get("fulfillment_type", "¿Es a Domicilio o Recoges en Tienda?", "es_a_domicilio_o_recoges_en_tienda", "Domicilio o Tienda", "Tipo de entrega");
  const zone = canonicalZone(get(
    "zone",
    "Zona",
    "contact.zone",
    "contact.zona",
    "customData.zone",
    "customData.Zona",
    "customFields.zone",
    "customFields.Zona",
    "Contact.Custom Fields.Zone",
    "Contact.Custom Fields.Zona",
  ));
  if (!phone || !(name || business) || !text) throw new Error("Faltan nombre o negocio, teléfono o Coloca tu Pedido");
  const fulfillmentValue = fulfillment?.toLowerCase() ?? "";
  const pickup = /pickup|tienda|recog/.test(fulfillmentValue);
  const delivery = /delivery|domicilio|env[ií]o/.test(fulfillmentValue);
  if (!pickup && !delivery) throw new Error("Entrega debe ser Domicilio o Tienda");
  const submission = get("submission_id", "submissionId", "event_id", "eventId", "formSubmissionId");
  const directAddress = typeof payload.address === "string" && payload.address.trim() ? payload.address.trim() : undefined;
  // `location.address` es la sede de Fénix, no la dirección del contacto. Priorizar
  // siempre los campos explícitos del contacto/formulario para no contaminar pedidos.
  const customerAddress = get(
    "customData.address",
    "customData.Dirección",
    "address1",
    "contact.address1",
    "full_address",
    "contact.full_address",
    "Dirección",
    "Agrega Dirección de Entrega",
  ) ?? directAddress;
  return {
    source: "form" as const,
    source_reference: submission ? `ghl:${form}:${submission}` : undefined,
    customer_type: "wholesale" as const,
    customer: {
      name: name || business!, phone: phone.replace(/[\s()-]/g, ""), business_name: business,
      tax_id: get("tax_id", "Nit o Cédula"), email: get("email", "contact.email"),
      address: customerAddress?.replace(/,\s*$/, ""),
    },
    fulfillment_type: pickup ? "pickup" as const : "delivery" as const,
    route: zone,
    notes: get("observations", "Observaciones Adicionales"),
    items: parseOrderText(text),
    form_data: {
      form, order_text: text, tax_id: get("tax_id", "Nit o Cédula"), billing: get("billing", "Facturación"),
      maps_url: get("maps_url", "Ubicación de Maps"),
      receiver_phone: get("receiver_phone", "Número de Quien Recibe"),
      payment_proof: getFileUrl("payment_proof", "Aqui puedes subir tu comprobante de Pago"),
      contact_id: get("contactId", "contact_id", "contact.id"),
      location_id: get("locationId", "location_id", "location.id"),
      conversation_id: get("conversationId", "conversation_id", "conversation.id"),
      conversation_url: get("conversationUrl", "conversation_url"),
      original_payload: payload,
    },
  };
}
