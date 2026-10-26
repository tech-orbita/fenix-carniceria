export type WholesaleHelpPayload = {
  locationId?: string;
  contactId?: string;
  conversationId?: string;
  conversationUrl?: string;
  sourceEventId?: string;
  reason: string;
  customer: {
    name: string;
    businessName?: string;
    phone: string;
    address?: string;
    neighborhood?: string;
    city?: string;
  };
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(maxLength: number, ...values: unknown[]) {
  const value = values.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  return value?.trim().slice(0, maxLength);
}

export function normalizeWholesaleHelpPayload(value: unknown):
  | { ok: true; data: WholesaleHelpPayload }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "Invalid help payload" };
  const body = value as Record<string, unknown>;
  const customer = objectValue(body.customer);
  const phone = textValue(40, customer.phone)?.replace(/[^\d+]/g, "") ?? "";
  if (!phone) return { ok: false, error: "Customer phone is required" };

  const name = textValue(200, customer.name, customer.businessName, customer.business_name, customer.companyName) ?? "Cliente WhatsApp";
  const reason = textValue(2_000, body.reason) ?? "El cliente mayorista requiere atención humana.";
  return {
    ok: true,
    data: {
      locationId: textValue(160, body.locationId, body.location_id),
      contactId: textValue(160, body.contactId, body.contact_id),
      conversationId: textValue(160, body.conversationId, body.conversation_id),
      conversationUrl: textValue(1_000, body.conversationUrl, body.conversation_url),
      sourceEventId: textValue(250, body.sourceEventId, body.source_event_id),
      reason,
      customer: {
        name,
        businessName: textValue(200, customer.businessName, customer.business_name, customer.companyName),
        phone,
        address: textValue(500, customer.address, customer.direccion),
        neighborhood: textValue(200, customer.neighborhood, customer.barrio),
        city: textValue(120, customer.city, customer.ciudad),
      },
    },
  };
}
