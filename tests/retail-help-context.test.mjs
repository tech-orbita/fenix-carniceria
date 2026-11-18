import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isStandaloneRetailHelpPayload } from "../src/lib/orders/retail-normalization.ts";

test("una alerta de ayuda sin productos no se considera pedido operativo", () => {
  assert.equal(isStandaloneRetailHelpPayload({ helpWithoutOrder: true }), true);
  assert.equal(isStandaloneRetailHelpPayload({ helpWithoutOrder: false }), false);
  assert.equal(isStandaloneRetailHelpPayload({ rawOrderText: "1 libra de pulpa" }), false);
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
  assert.match(helpGuard, /startsWith\('CLIENTE:'\)/);
});

test("n8n confirma únicamente después del registro e incluye el número real", () => {
  const workflow = JSON.parse(readFileSync(new URL("../n8n/fenix-minoristas-pedido.json", import.meta.url), "utf8"));
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const config = nodes.get("Config").parameters.assignments.assignments;
  const confirmationEnabled = config.find((entry) => entry.name === "SEND_CONFIRMATION");
  const confirmationBody = nodes.get("Confirmar al cliente").parameters.jsonBody;
  const resultCode = nodes.get("Resultado").parameters.jsCode;

  assert.equal(confirmationEnabled.value, "true");
  assert.match(resultCode, /Boolean\(body\.order_number\)/);
  assert.match(confirmationBody, /orderNumber/);
  assert.match(confirmationBody, /quedó registrado/);
});
