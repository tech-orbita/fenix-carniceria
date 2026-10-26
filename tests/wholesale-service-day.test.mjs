import { test } from "node:test";
import assert from "node:assert/strict";

import { isWholesaleOperatingDay, wholesaleServiceDay } from "../src/lib/orders/wholesale-service-day.ts";

test("aplica el corte mayorista de las 3 a. m. de Bogotá", () => {
  assert.equal(wholesaleServiceDay("2026-10-26T02:59:00-05:00"), "2026-10-26");
  assert.equal(wholesaleServiceDay("2026-10-26T03:01:00-05:00"), "2026-10-27");
});

test("no programa entregas automáticas en domingo", () => {
  assert.equal(wholesaleServiceDay("2026-10-31T04:00:00-05:00"), "2026-11-03");
});

test("reconoce festivos colombianos fijos, trasladados y de Semana Santa", () => {
  assert.equal(isWholesaleOperatingDay("2026-07-20"), false);
  assert.equal(isWholesaleOperatingDay("2026-10-12"), false);
  assert.equal(isWholesaleOperatingDay("2026-04-03"), false);
  assert.equal(isWholesaleOperatingDay("2026-10-13"), true);
});

test("respeta una fecha asignada manualmente por el personal", () => {
  assert.equal(wholesaleServiceDay("2026-10-31T04:00:00-05:00", "2026-11-01"), "2026-11-01");
});
