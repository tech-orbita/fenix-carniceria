import { test } from "node:test";
import assert from "node:assert/strict";

import { matchRetailProduct, normalizeRetailItems, requiresRetailHelp } from "../src/lib/orders/retail-normalization.ts";

const catalog = [
  { id: "pulpa", name: "Pulpa", catalogKey: "cerdo:pulpa", pricePerKg: 22_000 },
  { id: "molida", name: "Molida súper especial", catalogKey: "res:molida super especial", pricePerKg: 23_000 },
  { id: "butifarra", name: "Butifarra", catalogKey: "otros:butifarra", pricePerKg: 9_000 },
  { id: "pechuga", name: "Pechuga congelada", catalogKey: "pollo:pechuga congelada", pricePerKg: 14_000 },
  { id: "pernil", name: "Pernil mixto (contramuslo)", catalogKey: "pollo:pernil mixto (contramuslo)", pricePerKg: 8_000 },
  { id: "hueso-pechuga", name: "Hueso de pechuga", catalogKey: "pollo:hueso de pechuga", pricePerKg: 5_000 },
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

test("entiende pesos después del producto y conserva cantidades por unidad", () => {
  const extendedCatalog = [
    ...catalog,
    { id: "punta", name: "Punta gorda", catalogKey: "res:punta gorda", pricePerKg: 39_000 },
    { id: "sobrebarriga", name: "Sobre barriga delgada", catalogKey: "res:sobre barriga delgada", pricePerKg: 29_000 },
    { id: "muslo", name: "Muslo Colombina", catalogKey: "pollo:muslo colombina", pricePerKg: 10_000 },
    { id: "ala", name: "Ala especial", catalogKey: "pollo:ala especial", pricePerKg: 11_000 },
  ];
  const items = normalizeRetailItems([], [
    "punta gorda 2 kilos",
    "sobrebarriga 2 libras",
    "4 libras de pulpa",
    "muslo colombia 4",
    "ala especial 5 alas",
  ].join("\n"), extendedCatalog);

  assert.deepEqual(items.map(({ product_name, quantity, unit_price, notes }) => ({ product_name, quantity, unit_price, notes })), [
    { product_name: "Punta gorda", quantity: 2, unit_price: 39_000, notes: "punta gorda 2 kilos" },
    { product_name: "Sobre barriga delgada", quantity: 1, unit_price: 29_000, notes: "sobrebarriga 2 libras" },
    { product_name: "Pulpa", quantity: 2, unit_price: 22_000, notes: "4 libras de pulpa" },
    { product_name: "Muslo Colombina", quantity: 4, unit_price: 10_000, notes: "muslo colombia 4" },
    { product_name: "Ala especial", quantity: 5, unit_price: 11_000, notes: "ala especial 5 alas" },
  ]);
  assert.deepEqual(items.slice(-2).map(({ unit }) => unit), ["und", "und"]);
});

test("usa exclusivamente los nombres minoristas para pechuga y pierna pernil", () => {
  const items = normalizeRetailItems([], "2 pechugas\n4 pierna pernil", catalog);
  assert.deepEqual(items.map(({ product_name, quantity, unit, unit_price }) => ({ product_name, quantity, unit, unit_price })), [
    { product_name: "Pechuga congelada", quantity: 2, unit: "und", unit_price: 14_000 },
    { product_name: "Pernil mixto (contramuslo)", quantity: 4, unit: "und", unit_price: 8_000 },
  ]);
});

test("respeta las unidades explícitas que entrega el agente", () => {
  const [item] = normalizeRetailItems([{ product_name: "pechuga", quantity: 2, unit: "unidades" }], "", catalog);
  assert.deepEqual({ name: item.product_name, quantity: item.quantity, unit: item.unit }, { name: "Pechuga congelada", quantity: 2, unit: "und" });
});

test("calcula pesos explícitos aunque el cliente agregue expresiones de cortesía", () => {
  const extendedCatalog = [
    ...catalog,
    { id: "sobrebarriga", name: "Sobre barriga delgada", catalogKey: "res:sobre barriga delgada", pricePerKg: 29_000 },
  ];
  const [item] = normalizeRetailItems([], "2 lb de sobrebarriga porfavor", extendedCatalog);
  assert.deepEqual(
    { name: item.product_name, quantity: item.quantity, unit: item.unit, price: item.unit_price },
    { name: "Sobre barriga delgada", quantity: 1, unit: "kg", price: 29_000 },
  );
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
