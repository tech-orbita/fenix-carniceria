import { test } from "node:test";
import assert from "node:assert/strict";

import { formatRetailNumberInput, parseRetailNumberInput } from "../src/lib/orders/retail-edit.ts";

test("acepta cero inicial y coma al capturar un peso", () => {
  assert.equal(parseRetailNumberInput("0,5"), 0.5);
  assert.equal(parseRetailNumberInput("0.625"), 0.625);
  assert.equal(formatRetailNumberInput(0.5), "0,5");
});

test("un precio pendiente se presenta vacío y acepta el número sin cero inicial", () => {
  assert.equal(formatRetailNumberInput(0), "");
  assert.equal(parseRetailNumberInput("11000", 0), 11_000);
  assert.equal(parseRetailNumberInput("", 0), 0);
});
