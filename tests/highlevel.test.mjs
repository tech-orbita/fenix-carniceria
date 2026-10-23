import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHighLevelForm } from "../src/lib/orders/highlevel.ts";
const base = { "Nombre Completo": "Ana", "Teléfono": "+57 300 123 4567", "Coloca tu Pedido": "2 kg de costilla\nMolida por confirmar", "¿Es a Domicilio o Recoges en Tienda?": "Domicilio" };
test("cliente: preserva pedido libre y solo clasifica partidas inequívocas", () => {
  const order = mapHighLevelForm(base, "mayorista-cliente");
  assert.equal(order.form_data.order_text, base["Coloca tu Pedido"]);
  assert.deepEqual(order.items, [{ product_name: "Costilla", quantity: 2, unit: "kg" }]);
  assert.equal(order.customer.phone, "+573001234567");
});
test("nuevo: mapea campos personalizados y datos de entrega", () => {
  const order = mapHighLevelForm({ ...base, customData: { "Nombre del Negocio": "Asados", "Nit o Cédula": "123", "Facturación": "Electrónica", "Ubicación de Maps": "https://maps.google.com/", "Número de Quien Recibe": "3001234568" }, submission_id: "envio-1" }, "nuevo-mayorista");
  assert.equal(order.customer.business_name, "Asados");
  assert.equal(order.customer.tax_id, "123");
  assert.equal(order.form_data.billing, "Electrónica");
  assert.equal(order.source_reference, "ghl:nuevo-mayorista:envio-1");
});
test("rechaza payload incompleto y variables sin sustituir", () => {
  assert.throws(() => mapHighLevelForm({}, "mayorista-cliente"));
  assert.throws(() => mapHighLevelForm({ ...base, "Teléfono": "{{contact.phone}}" }, "mayorista-cliente"));
  assert.throws(() => mapHighLevelForm(base, "nuevo-mayorista"));
});

test("clasifica el catálogo mayorista y conserva indicadores de blanda", () => {
  const order = mapHighLevelForm({
    ...base,
    "Coloca tu Pedido": "10 libras de capón; 4 kg de lomo fino; 2 kg de pezuña de cerdo",
  }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Blanda", quantity: 10, unit: "lb", preparation: "C" },
    { product_name: "Lomo fino", quantity: 4, unit: "kg" },
    { product_name: "Pezuña cerdo", quantity: 2, unit: "kg" },
  ]);
});

test("conserva los identificadores de HighLevel para pipeline y conversación", () => {
  const order = mapHighLevelForm({ ...base, contactId: "contact-1", locationId: "location-1", conversationId: "conversation-1" }, "mayorista-cliente");
  assert.equal(order.form_data.contact_id, "contact-1");
  assert.equal(order.form_data.location_id, "location-1");
  assert.equal(order.form_data.conversation_id, "conversation-1");
});

test("envía productos sin columna al comodín conservando su nombre", () => {
  const order = mapHighLevelForm({ ...base, "Coloca tu Pedido": "3 kg de osobuco especial" }, "mayorista-cliente");
  assert.deepEqual(order.items, [{ product_name: "Comodín", quantity: 3, unit: "kg", preparation: "Osobuco especial" }]);
});
