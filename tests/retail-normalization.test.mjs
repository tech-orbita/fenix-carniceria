import { test } from "node:test";
import assert from "node:assert/strict";

import { matchRetailProduct, normalizeRetailItems, requiresRetailHelp } from "../src/lib/orders/retail-normalization.ts";

const catalog = [
  { id: "pulpa", name: "Pulpa", catalogKey: "cerdo:pulpa", pricePerKg: 22_000 },
  { id: "molida", name: "Molida súper especial", catalogKey: "res:molida super especial", pricePerKg: 23_000 },
  { id: "butifarra", name: "Butifarra", catalogKey: "otros:butifarra", pricePerKg: 9_000 },
  { id: "pechuga", name: "Pechuga congelada", catalogKey: "pollo:pechuga congelada", pricePerKg: 14_000 },
  { id: "costilla-res", name: "Costilla", catalogKey: "res:costilla", pricePerKg: 20_400 },
  { id: "costilla-cerdo", name: "Costilla", catalogKey: "cerdo:costilla", pricePerKg: 20_000 },
];

test("convierte libras a kilos y aplica el precio minorista por kilo", () => {
  const items = normalizeRetailItems([], "2 libras de pulpa\n1 libra de molida especial\n1 butifarra", catalog);
  assert.deepEqual(items.map(({ product_id, product_name, quantity, unit, unit_price }) => ({ product_id, product_name, quantity, unit, unit_price })), [
    { product_id: "pulpa", product_name: "Pulpa", quantity: 1, unit: "kg", unit_price: 22_000 },
    { product_id: "molida", product_name: "Molida súper especial", quantity: 0.5, unit: "kg", unit_price: 23_000 },
    { product_id: "butifarra", product_name: "Butifarra", quantity: 1, unit: "kg", unit_price: 9_000 },
  ]);
});

test("normaliza las líneas operativas que envía n8n", () => {
  const items = normalizeRetailItems([
    { name: "2 libras de pulpa", quantity: 1, rawText: "2 libras de pulpa" },
    { name: "1 libra de molida especial", quantity: 1, rawText: "1 libra de molida especial" },
  ], "", catalog);
  assert.deepEqual(items.map(({ product_name, quantity, unit_price }) => ({ product_name, quantity, unit_price })), [
    { product_name: "Pulpa", quantity: 1, unit_price: 22_000 },
    { product_name: "Molida súper especial", quantity: 0.5, unit_price: 23_000 },
  ]);
});

test("calcula kilos cuando el cliente compra por valor", () => {
  const [item] = normalizeRetailItems([], "$11.000 de pulpa", catalog);
  assert.equal(item.quantity, 0.5);
  assert.equal(item.unit_price, 22_000);
});

test("conserva un producto desconocido en kilos y sin inventar precio", () => {
  const [item] = normalizeRetailItems([], "1 kilo de menudo", catalog);
  assert.equal(item.product_name, "Menudo");
  assert.equal(item.quantity, 1);
  assert.equal(item.unit, "kg");
  assert.equal(item.unit_price, 0);
  assert.equal(item.product_id, null);
});

test("usa la categoría escrita para resolver nombres ambiguos", () => {
  assert.equal(matchRetailProduct("costilla de cerdo", catalog)?.id, "costilla-cerdo");
  assert.equal(matchRetailProduct("costilla de res", catalog)?.id, "costilla-res");
});

test("solo clasifica aclaraciones o solicitudes de asesor como ayuda", () => {
  assert.equal(requiresRetailHelp("Quiero hablar con un asesor"), true);
  assert.equal(requiresRetailHelp("El cliente necesita una aclaración del pedido"), true);
  assert.equal(requiresRetailHelp("No se pudo leer el pedido automáticamente"), false);
  assert.equal(requiresRetailHelp("El panel no aceptó el pedido"), false);
});
