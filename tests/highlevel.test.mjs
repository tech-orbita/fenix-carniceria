import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHighLevelForm } from "../src/lib/orders/highlevel.ts";
const base = { "Nombre Completo": "Ana", "Teléfono": "+57 300 123 4567", "Coloca tu Pedido": "2 kg de costilla\nMolida por confirmar", "¿Es a Domicilio o Recoges en Tienda?": "Domicilio" };
test("cliente: preserva pedido libre y no inventa partidas", () => {
  const order = mapHighLevelForm(base, "mayorista-cliente");
  assert.equal(order.form_data.order_text, base["Coloca tu Pedido"]);
  assert.deepEqual(order.items, []);
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
