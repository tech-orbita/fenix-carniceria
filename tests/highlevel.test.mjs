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
});

test("nuevo: usa el nombre completo si GHL no llena Company Name", () => {
  const order = mapHighLevelForm(base, "nuevo-mayorista");
  assert.equal(order.customer.name, "Ana");
  assert.equal(order.customer.business_name, "Ana");
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

test("acepta el payload anidado que envía un workflow de HighLevel", () => {
  const order = mapHighLevelForm({
    contact: { id: "contact-nested", name: "Restaurante Pamela", phone: "+57 301 555 0101" },
    location: { id: "location-nested" },
    conversation: { id: "conversation-nested" },
    customData: [
      { fieldKey: "Nombre del Negocio", value: "Restaurante Pamela" },
      { fieldKey: "Coloca tu Pedido", value: "5 kg de costilla" },
      { fieldKey: "Domicilio o Tienda", value: "Recoges en tienda" },
    ],
    formSubmissionId: "submission-nested",
  }, "nuevo-mayorista");
  assert.equal(order.form_data.contact_id, "contact-nested");
  assert.equal(order.form_data.location_id, "location-nested");
  assert.equal(order.form_data.conversation_id, "conversation-nested");
  assert.equal(order.fulfillment_type, "pickup");
  assert.equal(order.source_reference, "ghl:nuevo-mayorista:submission-nested");
});

test("envía productos sin columna al comodín conservando su nombre", () => {
  const order = mapHighLevelForm({ ...base, "Coloca tu Pedido": "3 kg de osobuco especial" }, "mayorista-cliente");
  assert.deepEqual(order.items, [{ product_name: "Comodín", quantity: 3, unit: "kg", preparation: "Osobuco especial" }]);
});

test("conserva todas las líneas aunque omitan o inviertan la unidad", () => {
  const order = mapHighLevelForm({
    ...base,
    "Coloca tu Pedido": "10 CAPON\n2 SOBREBARRIGA\n10 MOLIDA\n15 CHURRASCO\n6 PATAS DE RES\nmolida especial 4 lib\nk carne molida 1",
  }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Blanda", quantity: 10, unit: "kg", preparation: "C" },
    { product_name: "Sobrebarriga", quantity: 2, unit: "kg" },
    { product_name: "Comodín", quantity: 10, unit: "kg", preparation: "Molida" },
    { product_name: "Comodín", quantity: 15, unit: "kg", preparation: "Churrasco" },
    { product_name: "Pata", quantity: 6, unit: "kg" },
    { product_name: "Molida especial", quantity: 4, unit: "lb" },
    { product_name: "Comodín", quantity: 1, unit: "kg", preparation: "Carne molida" },
  ]);
});

test("prioriza la dirección del contacto sobre la dirección de la sede", () => {
  const order = mapHighLevelForm({
    ...base,
    location: { address: "Dirección de Fénix" },
    address1: "Calle 8 # 69-38",
    customData: { address: "Carrera 20 # 10-15, " },
  }, "nuevo-mayorista");
  assert.equal(order.customer.address, "Carrera 20 # 10-15");
});

test("guarda la zona registrada en el formulario aunque GHL envíe el nombre completo del campo", () => {
  const order = mapHighLevelForm({
    ...base,
    "Contact.Custom Fields.Zona": "Barranquilla Norte",
  }, "nuevo-mayorista");
  assert.equal(order.route, "Barranquilla Norte");
});

test("conserva una opción nueva de zona para que el panel la pueda registrar", () => {
  const order = mapHighLevelForm({
    ...base,
    Zona: "Suroccidente especial",
  }, "nuevo-mayorista");
  assert.equal(order.route, "Suroccidente especial");
});

test("acepta el comprobante de pago cuando HighLevel lo envía como lista de archivos", () => {
  const order = mapHighLevelForm({
    ...base,
    customData: [
      { fieldKey: "Aqui puedes subir tu comprobante de Pago", value: ["https://files.example/comprobante.jpg"] },
    ],
  }, "mayorista-cliente");
  assert.equal(order.form_data.payment_proof, "https://files.example/comprobante.jpg");
});

test("interpreta las líneas reales de blanda, cerdo y pollo sin perder productos", () => {
  const order = mapHighLevelForm({
    ...base,
    "Coloca tu Pedido": "4 k blanda c\n2 k de cerdo lomo\n6 k blanda L\n5 pechugas pollo\n4 pierna pernil",
  }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Blanda", quantity: 4, unit: "kg", preparation: "C" },
    { product_name: "Lomo cerdo", quantity: 2, unit: "kg" },
    { product_name: "Blanda", quantity: 6, unit: "kg", preparation: "L" },
    { product_name: "Comodín", quantity: 5, unit: "kg", preparation: "Pechugas pollo" },
    { product_name: "Comodín", quantity: 4, unit: "kg", preparation: "Pierna pernil" },
  ]);
});
