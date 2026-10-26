import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeWholesaleHelpPayload } from "../src/lib/orders/wholesale-help-payload.ts";

test("normaliza una solicitud de ayuda mayorista sin formulario", () => {
  const result = normalizeWholesaleHelpPayload({
    location_id: "loc-1",
    contact_id: "contact-1",
    conversation_id: "conversation-1",
    source_event_id: "event-1",
    reason: "  Necesito hablar con un asesor  ",
    customer: {
      name: "  Ana Pérez  ",
      business_name: "  Tienda Central  ",
      phone: "+57 300 123 4567",
      direccion: "Calle 10 # 20-30",
      barrio: "Centro",
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.customer.phone, "+573001234567");
  assert.equal(result.data.customer.businessName, "Tienda Central");
  assert.equal(result.data.customer.address, "Calle 10 # 20-30");
  assert.equal(result.data.reason, "Necesito hablar con un asesor");
  assert.equal(result.data.sourceEventId, "event-1");
});

test("rechaza una solicitud sin teléfono", () => {
  const result = normalizeWholesaleHelpPayload({ customer: { name: "Tienda Central" } });
  assert.deepEqual(result, { ok: false, error: "Customer phone is required" });
});

test("acepta una solicitud mínima y asigna un motivo por defecto", () => {
  const result = normalizeWholesaleHelpPayload({ customer: { phone: "3001234567" } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.customer.name, "Cliente WhatsApp");
  assert.equal(result.data.reason, "El cliente mayorista requiere atención humana.");
});
