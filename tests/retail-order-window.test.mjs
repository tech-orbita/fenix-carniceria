import { test } from "node:test";
import assert from "node:assert/strict";

import { belongsToCurrentRetailWindow, retailOrderWindowStart } from "../src/lib/orders/retail-order-window.ts";

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
