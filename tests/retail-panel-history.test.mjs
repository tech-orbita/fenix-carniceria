import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../src/app/dashboard/retail-panel.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");

test("las fechas minoristas abren todos los movimientos del periodo", () => {
  assert.match(panel, /type RetailView = OperationalPhase \| "all"/);
  assert.match(panel, /setPreset\(option\); setActiveView\("all"\)/);
  assert.match(panel, />Movimientos<small>Todo el periodo<\/small>/);
  assert.match(panel, /activeView === "all" \? operationalOrders/);
});

test("por cobrar muestra pedidos pendientes de cualquier etapa", () => {
  assert.match(panel, /setActiveView\("all"\); setPaymentFilter\("pending"\)/);
  assert.match(panel, /paymentCounts.*viewOrders\.filter\(\(order\) => !isPaid\(order\)\)/s);
});

test("minoristas carga historial suficiente para consultar días anteriores", () => {
  assert.match(page, /viewer\.customerType === "wholesale" \? 1 : 10/);
  assert.match(page, /requestedRows = page \* dashboardPageSize/);
});
