import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isStandaloneRetailHelpPayload, normalizeRetailItems, retailHelpOrderText } from "../src/lib/orders/retail-normalization.ts";

test("una alerta de ayuda sin productos no se considera pedido operativo", () => {
  assert.equal(isStandaloneRetailHelpPayload({ helpWithoutOrder: true }), true);
  assert.equal(isStandaloneRetailHelpPayload({ helpWithoutOrder: false }), false);
  assert.equal(isStandaloneRetailHelpPayload({ rawOrderText: "1 libra de pulpa" }), false);
});

test("recupera únicamente los productos que el cliente envió antes de pasar la ayuda a Nuevos", () => {
  const transcript = `FÉNIX J.A.: ¿Qué productos necesitas?\nCLIENTE: 20 libras de carne (para 40 porciones)\n10 libras de lomo de cerdo para (20 porciones)\n10- pechuga relajada para (20 porciones)\nFÉNIX J.A.: ¿La pechuga la prefieres relajada o entera?\nCLIENTE: Entregarle el pedido a Aliro`;
  const orderText = retailHelpOrderText(transcript);

  assert.equal(orderText, "20 libras de carne\n10 libras de lomo de cerdo\n10 pechuga relajada");
  const items = normalizeRetailItems([], orderText, []);
  assert.deepEqual(items.map((item) => [item.product_name, item.quantity, item.unit]), [
    ["Carne", 10, "kg"],
    ["Lomo de cerdo", 5, "kg"],
    ["Pechuga relajada", 10, "und"],
  ]);
});

test("el workflow conserva el cursor de una alerta y clasifica solo texto del cliente", () => {
  const workflow = JSON.parse(readFileSync(new URL("../n8n/fenix-minoristas-pedido.json", import.meta.url), "utf8"));
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const helpBody = nodes.get("Pedir ayuda (extracción falló)").parameters.jsonBody;
  const rejectedBody = nodes.get("Pedir ayuda (app rechazó)").parameters.jsonBody;
  const helpGuard = nodes.get("¿Mensaje sin pedido?").parameters.conditions.conditions[0].leftValue;

  assert.match(helpBody, /contextUntil/);
  assert.match(rejectedBody, /contextUntil/);
  assert.match(rejectedBody, /sourceEventId/);
  assert.match(helpBody, /forceRegister: true/);
  assert.match(helpBody, /rawOrderText/);
  assert.match(rejectedBody, /forceRegister: true/);
  assert.match(rejectedBody, /rawOrderText/);
  assert.match(helpGuard, /inboundMessages === 0/);
});

test("n8n confirma únicamente después del registro e incluye el número real", () => {
  const workflow = JSON.parse(readFileSync(new URL("../n8n/fenix-minoristas-pedido.json", import.meta.url), "utf8"));
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const config = nodes.get("Config").parameters.assignments.assignments;
  const confirmationEnabled = config.find((entry) => entry.name === "SEND_CONFIRMATION");
  const confirmationBody = nodes.get("Confirmar al cliente").parameters.jsonBody;
  const scheduledConfirmationBody = nodes.get("Avisar día de entrega").parameters.jsonBody;
  const resultCode = nodes.get("Resultado").parameters.jsCode;

  assert.equal(confirmationEnabled.value, "true");
  assert.match(resultCode, /Boolean\(body\.order_number\)/);
  assert.match(confirmationBody, /orderNumber/);
  assert.match(confirmationBody, /quedó registrado/);
  for (const messageBody of [confirmationBody, scheduledConfirmationBody]) {
    assert.match(messageBody, /lastMessageConversationProviderId/);
    assert.match(messageBody, /lastChannelAccount/);
    assert.match(messageBody, /conversationProviderId/);
    assert.match(messageBody, /type = providerId \|\| \/SMS\/i\.test\(lastMessageType\) \? 'SMS' : 'WhatsApp'/);
  }
});

test("el extractor crea una lista nueva y solo anexa por instrucción explícita", () => {
  const workflow = JSON.parse(readFileSync(new URL("../n8n/fenix-minoristas-pedido.json", import.meta.url), "utf8"));
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const extractorPrompt = nodes.get("Basic LLM Chain").parameters.messages.messageValues[0].message;

  assert.match(extractorPrompt, /No le pidas al cliente que confirme/);
  assert.match(extractorPrompt, /Una lista nueva de productos crea action=nuevo/);
  assert.match(extractorPrompt, /Solo devuelve action=anexo cuando el CLIENTE diga claramente/);
  assert.match(extractorPrompt, /Varios mensajes consecutivos con productos.*forman una sola lista/);
  assert.match(extractorPrompt, /para la abuela/);
  assert.doesNotMatch(extractorPrompt, /Falta confirmar si corresponde al pedido actual o a un pedido nuevo/);
});

test("el workflow evita repetir la confirmación de un lote duplicado", () => {
  const workflow = JSON.parse(readFileSync(new URL("../n8n/fenix-minoristas-pedido.json", import.meta.url), "utf8"));
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const confirmationConditions = nodes.get("¿Enviar confirmación?").parameters.conditions.conditions;

  assert.ok(confirmationConditions.some((condition) => /duplicate !== true/.test(condition.leftValue)));
});

test("el registro minorista se completa solo con nombre, teléfono, dirección y barrio", () => {
  const workflow = JSON.parse(readFileSync(new URL("../n8n/fenix-minoristas-pedido.json", import.meta.url), "utf8"));
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const contactUpdateBody = nodes.get("Guardar datos en el contacto GHL").parameters.jsonBody;

  assert.match(contactUpdateBody, /Boolean\(name && phone\)/);
  assert.match(contactUpdateBody, /Boolean\(address && neighborhood\)/);
  assert.doesNotMatch(contactUpdateBody, /Boolean\(name && phone && document\)/);
  assert.doesNotMatch(contactUpdateBody, /Boolean\(address && neighborhood && zone\)/);
});
