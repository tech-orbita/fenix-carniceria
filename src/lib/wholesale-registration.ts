export type WholesaleRegistration = {
  name: string;
  businessName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  city: string;
  requiresInvoice: boolean;
};

export class RegistrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationValidationError";
  }
}

function text(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RegistrationValidationError(`Completa ${label}.`);
  }
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length > maxLength) throw new RegistrationValidationError(`${label} es demasiado largo.`);
  return clean;
}

export function normalizeRegistrationPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const international = digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
  if (international.length < 8 || international.length > 15) {
    throw new RegistrationValidationError("Escribe un teléfono válido con indicativo de país.");
  }
  return `+${international}`;
}

export function validateWholesaleRegistration(value: unknown): WholesaleRegistration {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RegistrationValidationError("Los datos del formulario no son válidos.");
  }
  const body = value as Record<string, unknown>;
  const email = text(body.email, "el correo electrónico", 180).toLocaleLowerCase("es");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RegistrationValidationError("Escribe un correo electrónico válido.");
  }
  const taxId = text(body.taxId, "el NIT o cédula", 30);
  if (!/^[0-9a-záéíóúñ.\-\s]+$/iu.test(taxId)) {
    throw new RegistrationValidationError("El NIT o cédula contiene caracteres no válidos.");
  }
  if (body.consent !== true) {
    throw new RegistrationValidationError("Debes autorizar el tratamiento de datos para continuar.");
  }
  return {
    name: text(body.name, "el nombre completo", 120),
    businessName: text(body.businessName, "el nombre del negocio", 140),
    taxId,
    phone: normalizeRegistrationPhone(text(body.phone, "el teléfono", 30)),
    email,
    address: text(body.address, "la dirección", 220),
    neighborhood: text(body.neighborhood, "el barrio", 100),
    city: text(body.city, "la ciudad o municipio", 100),
    requiresInvoice: body.requiresInvoice === true,
  };
}

type HighLevelUpsertResponse = {
  new?: boolean;
  contact?: { id?: string };
};

async function highLevelRequest<T>(path: string, token: string, init: RequestInit, fetchImpl: typeof fetch) {
  const response = await fetchImpl(`https://services.leadconnectorhq.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "v3",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Orbita respondió ${response.status}`);
  return response.json() as Promise<T>;
}

export async function syncWholesaleRegistrationToHighLevel(
  registration: WholesaleRegistration,
  fetchImpl: typeof fetch = fetch,
) {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  if (!token || !locationId) throw new Error("La integración de Orbita no está configurada");

  const customFields: Array<{ id: string; fieldValue: string }> = [];
  const taxIdField = process.env.GHL_TAX_ID_CUSTOM_FIELD_ID?.trim();
  if (taxIdField) customFields.push({ id: taxIdField, fieldValue: registration.taxId });

  const result = await highLevelRequest<HighLevelUpsertResponse>("/contacts/upsert", token, {
    method: "POST",
    body: JSON.stringify({
      locationId,
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      address1: registration.address,
      city: registration.city,
      country: "CO",
      companyName: registration.businessName,
      source: "Formulario inscripción mayorista Fénix",
      createNewIfDuplicateAllowed: false,
      ...(customFields.length ? { customFields } : {}),
    }),
  }, fetchImpl);
  const contactId = result.contact?.id;
  if (!contactId) throw new Error("Orbita no devolvió el identificador del contacto");

  const tag = process.env.GHL_WHOLESALE_CUSTOMER_TAG?.trim() || "cliente mayorista";
  await highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/tags`, token, {
    method: "POST",
    body: JSON.stringify({ tags: [tag] }),
  }, fetchImpl);

  return { contactId, created: result.new === true };
}
