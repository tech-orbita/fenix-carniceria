import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHighLevelForm } from "../src/lib/orders/highlevel.ts";
const base = {
  "Nombre del establecimiento comercial": "Mercado Ana",
  "Nombre Completo": "Ana",
  Nit: "123456789",
  "Teléfono": "+57 300 123 4567",
  "Dirección": "Calle 10 # 20-30",
  "Coloca tu Pedido": "2 kg de costilla\nMolida por confirmar",
};
test("cliente: preserva el pedido libre y aplica la regla operativa de molida", () => {
  const order = mapHighLevelForm(base, "mayorista-cliente");
  assert.equal(order.form_data.order_text, base["Coloca tu Pedido"]);
  assert.deepEqual(order.items, [
    { product_name: "Costilla", quantity: 2, unit: "kg" },
    { product_name: "Molida especial", quantity: 0, unit: "cantidad" },
  ]);
  assert.match(order.notes, /Por aclarar en el pedido: Molida por confirmar/);
  assert.equal(order.customer.phone, "+573001234567");
});

test("ninguna línea ambigua desaparece de la tabla mayorista", () => {
  const order = mapHighLevelForm({ ...base, "Coloca tu Pedido": "2 kg costilla\nproducto secreto\n3 libras corte extraterrestre" }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Costilla", quantity: 2, unit: "kg" },
    { product_name: "Comodín", quantity: 0, unit: "cantidad", preparation: "Producto secreto" },
    { product_name: "Comodín", quantity: 3, unit: "lb", preparation: "Corte extraterrestre" },
  ]);
  assert.match(order.notes, /producto secreto/i);
  assert.match(order.notes, /3 libras corte extraterrestre/i);
});
test("nuevo: registra los campos activos del cliente", () => {
  const order = mapHighLevelForm({
    "Nombre del Negocio": "Asados",
    Nit: "123",
    Teléfono: "+573001234567",
    Nombre: "Ana",
    "Ingrese la Dirección de Entrega": "Carrera 5 # 6-70",
    "Coloca tu Pedido": "2 kg de costilla",
    submission_id: "envio-1",
  }, "nuevo-mayorista");
  assert.equal(order.customer.business_name, "Asados");
  assert.equal(order.customer.tax_id, "123");
  assert.equal(order.customer.address, "Carrera 5 # 6-70");
  assert.equal(order.fulfillment_type, "delivery");
  assert.equal(order.source_reference, "ghl:nuevo-mayorista:envio-1");
});
test("ignora zona del formulario para que el pedido llegue sin clasificar", () => {
  const order = mapHighLevelForm({ ...base, Zona: "Norte", zone: "Centro" }, "mayorista-cliente");
  assert.equal("route" in order, false);
});
test("rechaza payload incompleto y variables sin sustituir", () => {
  assert.throws(() => mapHighLevelForm({}, "mayorista-cliente"));
  assert.throws(() => mapHighLevelForm({ ...base, "Teléfono": "{{contact.phone}}" }, "mayorista-cliente"));
});

test("nuevo: exige el establecimiento que identifica al mayorista", () => {
  const withoutBusiness = { ...base };
  delete withoutBusiness["Nombre del establecimiento comercial"];
  assert.throws(() => mapHighLevelForm(withoutBusiness, "nuevo-mayorista"), /establecimiento/i);
});

test("cliente: reconoce la nueva etiqueta del establecimiento", () => {
  const order = mapHighLevelForm({
    ...base,
    "Nombre del establecimiento comercial": "Mercado Central",
  }, "mayorista-cliente");
  assert.equal(order.customer.business_name, "Mercado Central");
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

test("marca como R la blanda relajada o abierta", () => {
  const order = mapHighLevelForm({
    ...base,
    "Coloca tu Pedido": "4 libras blanda relajada; 2 kg blanda abierta",
  }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Blanda", quantity: 4, unit: "lb", preparation: "R" },
    { product_name: "Blanda", quantity: 2, unit: "kg", preparation: "R" },
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
      { fieldKey: "Nit", value: "900123456" },
      { fieldKey: "Ingrese la Dirección de Entrega", value: "Calle 8 # 10-20" },
      { fieldKey: "Coloca tu Pedido", value: "5 kg de costilla" },
    ],
    formSubmissionId: "submission-nested",
  }, "nuevo-mayorista");
  assert.equal(order.form_data.contact_id, "contact-nested");
  assert.equal(order.form_data.location_id, "location-nested");
  assert.equal(order.form_data.conversation_id, "conversation-nested");
  assert.equal(order.fulfillment_type, "delivery");
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
    { product_name: "Blanda", quantity: 10, unit: "cantidad", preparation: "C" },
    { product_name: "Sobrebarriga", quantity: 2, unit: "cantidad" },
    { product_name: "Molida especial", quantity: 10, unit: "cantidad" },
    { product_name: "Comodín", quantity: 15, unit: "cantidad", preparation: "Churrasco" },
    { product_name: "Pata", quantity: 6, unit: "cantidad" },
    { product_name: "Molida especial", quantity: 4, unit: "lb" },
    { product_name: "Molida especial", quantity: 1, unit: "kg" },
  ]);
});

test("separa molida corriente y pata de cerdo de los valores mayoristas por defecto", () => {
  const order = mapHighLevelForm({
    ...base,
    "Coloca tu Pedido": "3 kg molida; 2 kg carne molida; 4 kg molida corriente; 5 kg cerdo; 6 kg cerdo pata; 7 kg pata de cerdo",
  }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Molida especial", quantity: 3, unit: "kg" },
    { product_name: "Molida especial", quantity: 2, unit: "kg" },
    { product_name: "Molida corriente", quantity: 4, unit: "kg" },
    { product_name: "Lomo cerdo", quantity: 5, unit: "kg" },
    { product_name: "Pata cerdo", quantity: 6, unit: "kg" },
    { product_name: "Pata cerdo", quantity: 7, unit: "kg" },
  ]);
});

test("conserva con cero todos los cortes que el mayorista pide sin cantidad", () => {
  const order = mapHighLevelForm({
    ...base,
    "Coloca tu Pedido": "capón, punta gorda, costillo, rabo sin hueso, sobre barriga y chocosuela",
  }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Blanda", quantity: 0, unit: "cantidad", preparation: "C" },
    { product_name: "Punta gorda", quantity: 0, unit: "cantidad" },
    { product_name: "Costilla", quantity: 0, unit: "cantidad" },
    { product_name: "Rabo res", quantity: 0, unit: "cantidad", preparation: "Sin hueso" },
    { product_name: "Sobrebarriga", quantity: 0, unit: "cantidad" },
    { product_name: "Chocosuela", quantity: 0, unit: "cantidad" },
  ]);
});

test("no inventa unidades para patas de res cuando el cliente las omite", () => {
  const order = mapHighLevelForm({ ...base, "Coloca tu Pedido": "3 patas de res" }, "mayorista-cliente");
  assert.deepEqual(order.items, [{ product_name: "Pata", quantity: 3, unit: "cantidad" }]);
});

test("clasifica pescado y otros productos de la lista mayorista vigente", () => {
  const order = mapHighLevelForm({
    ...base,
    "Coloca tu Pedido": "2 kg bassa selecta, 1 kg bassa, 3 libras butifarra y 4 libras chorizo",
  }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Bassa selecta", quantity: 2, unit: "kg" },
    { product_name: "Bassa", quantity: 1, unit: "kg" },
    { product_name: "Butifarra", quantity: 3, unit: "lb" },
    { product_name: "Chorizo", quantity: 4, unit: "lb" },
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

test("ignora la zona aunque GHL envíe el nombre completo del campo", () => {
  const order = mapHighLevelForm({
    ...base,
    "Contact.Custom Fields.Zona": "Barranquilla Norte",
  }, "nuevo-mayorista");
  assert.equal("route" in order, false);
});

test("no usa opciones nuevas de zona enviadas por el formulario", () => {
  const order = mapHighLevelForm({
    ...base,
    Zona: "Suroccidente especial",
  }, "nuevo-mayorista");
  assert.equal("route" in order, false);
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

test("acepta exactamente los campos activos de Nuevo Mayorista", () => {
  const order = mapHighLevelForm({
    "Nombre del Negocio": "Prueba Orbita",
    Nit: "20000000",
    "Teléfono": "+573134368219",
    Nombre: "Prueba",
    "Ingrese la Dirección de Entrega": "Prueba Test#33-33",
    "Coloca tu Pedido": "Me puedes vender un capón y una pulpa de pierna de cerdo criollo",
    "Observaciones Adicionales": "Entregar temprano",
    "Aqui puedes subir tu comprobante de Pago": ["https://files.example/prueba.pdf"],
  }, "nuevo-mayorista");

  assert.deepEqual(order.customer, {
    name: "Prueba",
    phone: "+573134368219",
    business_name: "Prueba Orbita",
    tax_id: "20000000",
    email: undefined,
    address: "Prueba Test#33-33",
  });
  assert.equal(order.fulfillment_type, "delivery");
  assert.match(order.notes, /^Entregar temprano/);
  assert.match(order.notes, /Por aclarar en el pedido/);
  assert.equal(order.form_data.payment_proof, "https://files.example/prueba.pdf");
});

test("Cliente Mayorista solo necesita identificar la ficha y enviar el pedido", () => {
  const order = mapHighLevelForm({
    "Nombre del establecimiento comercial": "Mercado Central",
    "Teléfono": "+573001234567",
    "Coloca tu Pedido": "5 kg de costilla",
    "Observaciones Adicionales": "Corte delgado",
    "Aqui puedes subir tu comprobante de Pago": ["https://files.example/cliente.pdf"],
  }, "mayorista-cliente");

  assert.equal(order.customer.name, "Mercado Central");
  assert.equal(order.customer.business_name, "Mercado Central");
  assert.equal(order.customer.tax_id, undefined);
  assert.equal(order.customer.address, undefined);
  assert.equal(order.fulfillment_type, "delivery");
  assert.equal(order.form_data.payment_proof, "https://files.example/cliente.pdf");
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
    { product_name: "Pechuga", quantity: 5, unit: "cantidad" },
    { product_name: "Comodín", quantity: 4, unit: "cantidad", preparation: "Pierna pernil" },
  ]);
});

test("separa todos los productos cuando el formulario llega en una sola línea", () => {
  const order = mapHighLevelForm({ ...base, "Coloca tu Pedido": "6 pulpa cedo 3 molida corriente 2 molida especial 5 libras costillas de cerdo 1 bollo 6 libras de lomo ahumado del que viene en malla" }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Pulpa cerdo", quantity: 6, unit: "cantidad" },
    { product_name: "Molida corriente", quantity: 3, unit: "cantidad" },
    { product_name: "Molida especial", quantity: 2, unit: "cantidad" },
    { product_name: "Costilla cerdo", quantity: 5, unit: "lb" },
    { product_name: "Bollo", quantity: 1, unit: "cantidad" },
    { product_name: "Ahumada", quantity: 6, unit: "lb" },
  ]);
});

test("conserva R en todos los productos relajados y reconoce pechuga y muslos", () => {
  const order = mapHighLevelForm({ ...base, "Coloca tu Pedido": "13 libras de Costillitas\n10 libras de hueso\n2 libras de capón relado\n2 libras de lomo de cerdo relajado\n2 unidades de pechuga relajada\n2 libras de molida\n1 lengua\n3 libras de sobrebarriga\n3 libras de muslos de pollo" }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Costillita", quantity: 13, unit: "lb" },
    { product_name: "Hueso", quantity: 10, unit: "lb" },
    { product_name: "Blanda", quantity: 2, unit: "lb", preparation: "C/R" },
    { product_name: "Lomo cerdo", quantity: 2, unit: "lb", preparation: "R" },
    { product_name: "Pechuga", quantity: 2, unit: "und", preparation: "R" },
    { product_name: "Molida especial", quantity: 2, unit: "lb" },
    { product_name: "Lenguas", quantity: 1, unit: "cantidad" },
    { product_name: "Sobrebarriga", quantity: 3, unit: "lb" },
    { product_name: "Muslos de pollo", quantity: 3, unit: "lb" },
  ]);
});

test("conserva lomo ancho y expresiones exactas no numéricas del formulario", () => {
  const order = mapHighLevelForm({ ...base, "Coloca tu Pedido": "5 lb lomo ancho\nUn pedazo de blanda\nUn pedazo de espaldilla\nMolida 3 bolsas\nPatas 20\nFinos mucho\nDos lomos" }, "mayorista-cliente");
  assert.deepEqual(order.items, [
    { product_name: "Blanda", quantity: 5, unit: "lb", preparation: "Ancho" },
    { product_name: "Blanda", quantity: 1, unit: "pedazo", notes: "Un pedazo de blanda" },
    { product_name: "Espaldilla", quantity: 1, unit: "pedazo", notes: "Un pedazo de espaldilla" },
    { product_name: "Molida especial", quantity: 3, unit: "bolsas", notes: "Molida 3 bolsas" },
    { product_name: "Pata", quantity: 20, unit: "cantidad", notes: "Patas 20" },
    { product_name: "Lomo fino", quantity: 0, unit: "cantidad", notes: "Finos mucho" },
    { product_name: "Blanda", quantity: 2, unit: "cantidad", preparation: "L" },
  ]);
});
