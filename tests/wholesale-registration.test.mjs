import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRegistrationPhone,
  syncWholesaleRegistrationToHighLevel,
  validateWholesaleRegistration,
} from "../src/lib/wholesale-registration.ts";

const registration = {
  name: "María Pérez",
  businessName: "Restaurante La Esquina",
  taxId: "900.123.456-7",
  phone: "+573001234567",
  email: "maria@laesquina.co",
  address: "Carrera 53 # 80-10",
  neighborhood: "El Prado",
  city: "Barranquilla",
  requiresInvoice: true,
};

test("normaliza celulares colombianos a E.164", () => {
  assert.equal(normalizeRegistrationPhone("300 123 4567"), "+573001234567");
  assert.equal(normalizeRegistrationPhone("+57 (300) 123-4567"), "+573001234567");
});

test("valida y normaliza una inscripción completa", () => {
  const result = validateWholesaleRegistration({ ...registration, phone: "300 123 4567", email: " MARIA@LAESQUINA.CO ", consent: true });
  assert.equal(result.phone, "+573001234567");
  assert.equal(result.email, "maria@laesquina.co");
  assert.equal(result.requiresInvoice, true);
});

test("exige consentimiento", () => {
  assert.throws(() => validateWholesaleRegistration(registration), /autorizar el tratamiento/);
});

test("HighLevel hace upsert sin duplicar y luego agrega la etiqueta", async () => {
  const previous = {
    token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN,
    location: process.env.GHL_LOCATION_ID,
    tag: process.env.GHL_WHOLESALE_CUSTOMER_TAG,
  };
  process.env.GHL_PRIVATE_INTEGRATION_TOKEN = "test-token";
  process.env.GHL_LOCATION_ID = "location-1";
  process.env.GHL_WHOLESALE_CUSTOMER_TAG = "cliente mayorista";
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(calls.length === 1 ? { new: false, contact: { id: "contact-1" } } : { tags: ["cliente mayorista"] }), { status: calls.length === 1 ? 200 : 201 });
  };
  try {
    const result = await syncWholesaleRegistrationToHighLevel(registration, fakeFetch);
    assert.deepEqual(result, { contactId: "contact-1", created: false });
    assert.equal(calls[0].url, "https://services.leadconnectorhq.com/contacts/upsert");
    assert.equal(calls[0].body.createNewIfDuplicateAllowed, false);
    assert.equal(calls[0].body.tags, undefined);
    assert.equal(calls[1].url, "https://services.leadconnectorhq.com/contacts/contact-1/tags");
    assert.deepEqual(calls[1].body.tags, ["cliente mayorista"]);
  } finally {
    if (previous.token === undefined) delete process.env.GHL_PRIVATE_INTEGRATION_TOKEN; else process.env.GHL_PRIVATE_INTEGRATION_TOKEN = previous.token;
    if (previous.location === undefined) delete process.env.GHL_LOCATION_ID; else process.env.GHL_LOCATION_ID = previous.location;
    if (previous.tag === undefined) delete process.env.GHL_WHOLESALE_CUSTOMER_TAG; else process.env.GHL_WHOLESALE_CUSTOMER_TAG = previous.tag;
  }
});
