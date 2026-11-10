import { test } from "node:test";
import assert from "node:assert/strict";

import { belongsToCurrentRetailOrderDay, belongsToCurrentRetailWindow, retailDeliveryDay, retailOrderDayStart, retailOrderWindowStart, retailServiceDay } from "../src/lib/orders/retail-order-window.ts";

test("antes de las 2 p. m. conserva la ventana iniciada el día anterior", () => {
  const now = new Date("2026-10-26T18:59:59.000Z"); // 1:59:59 p. m. en Bogotá
  assert.equal(retailOrderWindowStart(now), "2026-10-25T19:00:00.000Z");
  assert.equal(belongsToCurrentRetailWindow("2026-10-26T15:37:03.000Z", now), true);
});

test("desde las 2 p. m. abre una nueva ventana de pedidos", () => {
  const now = new Date("2026-10-26T19:00:00.000Z"); // 2:00 p. m. en Bogotá
  assert.equal(retailOrderWindowStart(now), "2026-10-26T19:00:00.000Z");
  assert.equal(belongsToCurrentRetailWindow("2026-10-26T15:37:03.000Z", now), false);
  assert.equal(belongsToCurrentRetailWindow("2026-10-26T19:00:01.000Z", now), true);
});

test("muestra en el día operativo siguiente los pedidos recibidos después de las 2 p. m.", () => {
  assert.equal(retailServiceDay("2026-11-09T22:40:00.000Z"), "2026-11-10"); // 5:40 p. m. Bogotá
  assert.equal(retailServiceDay("2026-11-10T14:56:00.000Z"), "2026-11-10"); // 9:56 a. m. Bogotá
});

test("respeta una fecha de entrega minorista asignada manualmente", () => {
  assert.equal(retailDeliveryDay("2026-11-10T14:56:00.000Z", "2026-11-11"), "2026-11-11");
  assert.equal(retailDeliveryDay("2026-11-09T22:40:00.000Z", "Sin fecha"), "2026-11-10");
});

test("un pedido de otro día calendario nunca se reutiliza como anexo", () => {
  const now = new Date("2026-11-10T14:56:00.000Z"); // 9:56 a. m. Bogotá
  assert.equal(retailOrderDayStart(now), "2026-11-10T05:00:00.000Z");
  assert.equal(belongsToCurrentRetailOrderDay("2026-11-09T22:40:00.000Z", now), false);
  assert.equal(belongsToCurrentRetailOrderDay("2026-11-10T14:55:00.000Z", now), true);
});
