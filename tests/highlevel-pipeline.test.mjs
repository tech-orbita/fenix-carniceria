import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { sendHighLevelMessage, syncHighLevelOrderFields, syncRetailPipeline } from "../src/lib/orders/highlevel-pipeline.ts";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

function configure() {
  process.env.GHL_PRIVATE_INTEGRATION_TOKEN = "test-token";
  delete process.env.GHL_RETAIL_PIPELINE_ID;
  delete process.env.GHL_RETAIL_STAGE_PAID_ID;
}

test("mueve una oportunidad minorista existente a Pago", async () => {
  configure();
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    if (String(input).includes("/opportunities/pipelines?")) return Response.json({ pipelines: [{ id: "retail-pipeline", name: "Minoristas", stages: [{ id: "paid-stage", name: "Pago" }] }] });
    if (String(input).includes("/opportunities/search?")) return Response.json({ opportunities: [{ id: "opportunity-1" }] });
    return Response.json({ opportunity: { id: "opportunity-1" } });
  };

  const result = await syncRetailPipeline({ locationId: "location-payment", contactId: "contact-1" }, "paid", "Ana · PED-1", 52_000);

  assert.equal(result.ok, true);
  const update = requests.find((request) => request.url.endsWith("/opportunities/opportunity-1"));
  assert.equal(update?.init.method, "PUT");
  assert.deepEqual(JSON.parse(String(update?.init.body)), {
    pipelineId: "retail-pipeline",
    pipelineStageId: "paid-stage",
    name: "Ana · PED-1",
    status: "open",
    monetaryValue: 52_000,
  });
});

test("crea la oportunidad minorista en Realizo Pedido cuando aún no existe", async () => {
  configure();
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    if (String(input).includes("/opportunities/pipelines?")) return Response.json({ pipelines: [{ id: "retail-pipeline", name: "Minoristas", stages: [{ id: "placed-stage", name: "Realizo Pedido" }] }] });
    if (String(input).includes("/opportunities/search?")) return Response.json({ opportunities: [] });
    return Response.json({ opportunity: { id: "opportunity-2" } }, { status: 201 });
  };

  const result = await syncRetailPipeline({ locationId: "location-order", contactId: "contact-2" }, "order_placed", "Luis · PED-2", 0);

  assert.equal(result.ok, true);
  const create = requests.find((request) => request.url.endsWith("/opportunities/"));
  assert.equal(create?.init.method, "POST");
  assert.deepEqual(JSON.parse(String(create?.init.body)), {
    pipelineId: "retail-pipeline",
    pipelineStageId: "placed-stage",
    name: "Luis · PED-2",
    status: "open",
    monetaryValue: 0,
    locationId: "location-order",
    contactId: "contact-2",
  });
});

test("reconoce todas las etapas visibles del pipeline Minoristas", async () => {
  configure();
  const stages = [
    ["order_placed", "Realizo Pedido", "placed"],
    ["preparing", "En Preparacion", "preparing"],
    ["dispatched", "Despachados", "dispatched"],
    ["help", "Requiere ayuda", "help"],
    ["payment_pending", "Pendiente por Pago", "pending"],
    ["paid", "Pago", "paid"],
  ];

  for (const [stage, name, stageId] of stages) {
    let updatedBody;
    globalThis.fetch = async (input, init = {}) => {
      if (String(input).includes("/opportunities/pipelines?")) return Response.json({ pipelines: [{ id: "retail-pipeline", name: "Minoristas", stages: [{ id: stageId, name }] }] });
      if (String(input).includes("/opportunities/search?")) return Response.json({ opportunities: [{ id: "opportunity-1" }] });
      updatedBody = JSON.parse(String(init.body));
      return Response.json({ opportunity: { id: "opportunity-1" } });
    };
    const result = await syncRetailPipeline({ locationId: `location-${stage}`, contactId: "contact" }, stage, "Cliente · PED", 10);
    assert.equal(result.ok, true);
    assert.equal(updatedBody.pipelineStageId, stageId);
  }
});

test("envía un mensaje de WhatsApp al contacto por HighLevel", async () => {
  configure();
  let request;
  globalThis.fetch = async (input, init = {}) => {
    request = { url: String(input), init };
    return Response.json({ messageId: "message-1" });
  };

  const result = await sendHighLevelMessage({ locationId: "location-message", contactId: "contact-1" }, "Resumen del pedido");

  assert.equal(result.ok, true);
  assert.equal(request.url, "https://services.leadconnectorhq.com/conversations/messages");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(String(request.init.body)), {
    type: "WhatsApp",
    contactId: "contact-1",
    message: "Resumen del pedido",
  });
});

test("llena Orden y Valor del pedido en los campos del contacto", async () => {
  configure();
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    if (String(input).includes("/customFields?")) return Response.json({ customFields: [
      { id: "order-field", name: "Orden", fieldKey: "contact.orden" },
      { id: "total-field", name: "Valor del pedido", fieldKey: "contact.valor_del_pedido" },
    ] });
    return Response.json({ contact: { id: "contact-order-fields" } });
  };

  const result = await syncHighLevelOrderFields(
    { locationId: "location-order-fields", contactId: "contact-order-fields" },
    { orderNumber: "FEN-000123", total: 185_000 },
  );

  assert.equal(result.ok, true);
  const update = requests.find((request) => request.url.endsWith("/contacts/contact-order-fields"));
  assert.equal(update?.init.method, "PUT");
  assert.deepEqual(JSON.parse(String(update?.init.body)), {
    customFields: [
      { id: "order-field", field_value: "FEN-000123" },
      { id: "total-field", field_value: 185_000 },
    ],
  });
});
